-- ─────────────────────────────────────────────────────
--  FinanzasApp — Esquema inicial de PostgreSQL
--  Se ejecuta automáticamente al primer arranque del contenedor
-- ─────────────────────────────────────────────────────

-- Extensiones que necesitamos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- Generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Búsqueda de texto similar

-- ── Tabla: users ──────────────────────────────────────
-- Un usuario es el propietario de todos los demás datos.
-- Nunca borramos usuarios, solo los desactivamos (is_active).
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(255) NOT NULL,
    currency       VARCHAR(10)  NOT NULL DEFAULT 'PEN',
    timezone       VARCHAR(50)  NOT NULL DEFAULT 'America/Lima',
    is_active      BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    refresh_token  TEXT,          -- Token de sesión activa
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: categories ─────────────────────────────────
-- Categorías de transacciones.
-- is_default=true → global para todos los usuarios (user_id NULL)
-- is_default=false → creada por el usuario específico
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(10)  NOT NULL CHECK (type IN ('income', 'expense')),
    icon        VARCHAR(50),
    color       VARCHAR(7),        -- Color hex, ej: #22c55e
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: transactions ───────────────────────────────
-- El corazón de la app. Cada ingreso o gasto es una fila.
CREATE TABLE IF NOT EXISTS transactions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    type         VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency     VARCHAR(10) NOT NULL DEFAULT 'PEN',
    description  VARCHAR(500),
    notes        TEXT,
    date         DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url  TEXT,      -- URL del comprobante en MinIO
    tags         TEXT[],    -- Array de etiquetas libres: ['trabajo', 'viaje']
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: accounts ───────────────────────────────────
-- Cuentas bancarias, inversiones, efectivo o criptomonedas.
-- Su saldo suma para calcular el patrimonio neto.ff
CREATE TABLE IF NOT EXISTS accounts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    type         VARCHAR(20)  NOT NULL
                 CHECK (type IN ('bank', 'investment', 'cash', 'crypto')),
    institution  VARCHAR(255),   -- BCP, Interbank, Credicorp Capital, etc.
    balance      NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency     VARCHAR(10) NOT NULL DEFAULT 'PEN',
    color        VARCHAR(7),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: debts ──────────────────────────────────────
-- Deudas activas del usuario.
-- interest_rate se guarda como decimal: 0.12 = 12% anual
-- La proyección de pagos se calcula en el backend con amortización francesa
CREATE TABLE IF NOT EXISTS debts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    creditor         VARCHAR(255),
    principal_amount NUMERIC(15,2) NOT NULL CHECK (principal_amount > 0),
    current_balance  NUMERIC(15,2) NOT NULL,
    interest_rate    NUMERIC(6,4) NOT NULL DEFAULT 0,
    monthly_payment  NUMERIC(15,2),
    due_date         DATE,
    start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    currency         VARCHAR(10) NOT NULL DEFAULT 'PEN',
    status           VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paid', 'defaulted')),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: budgets ────────────────────────────────────
-- Presupuesto por categoría y período.
-- Permite comparar "presupuesto vs real" en el dashboard.
CREATE TABLE IF NOT EXISTS budgets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    period      VARCHAR(10) NOT NULL DEFAULT 'monthly'
                CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date  DATE NOT NULL,
    end_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Función: actualizar updated_at automáticamente ────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar el trigger a todas las tablas que tienen updated_at
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_debts_updated_at
    BEFORE UPDATE ON debts FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── Índices de rendimiento ────────────────────────────
-- Sin índices, las consultas por usuario se vuelven lentas
-- cuando hay miles de transacciones.
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_type      ON transactions(type);
CREATE INDEX idx_transactions_category  ON transactions(category_id);
CREATE INDEX idx_accounts_user_id       ON accounts(user_id);
CREATE INDEX idx_debts_user_id          ON debts(user_id);
CREATE INDEX idx_budgets_user_id        ON budgets(user_id);

-- ── Categorías por defecto ────────────────────────────
-- user_id = NULL significa que son globales (visibles para todos)
INSERT INTO categories (name, type, icon, color, is_default) VALUES
    -- Ingresos
    ('Salario',         'income',  'briefcase',     '#22c55e', true),
    ('Freelance',       'income',  'laptop',        '#3b82f6', true),
    ('Inversiones',     'income',  'trending-up',   '#8b5cf6', true),
    ('Otros ingresos',  'income',  'plus-circle',   '#06b6d4', true),
    -- Gastos
    ('Alimentación',    'expense', 'utensils',      '#f97316', true),
    ('Renta/Vivienda',  'expense', 'home',          '#ef4444', true),
    ('Transporte',      'expense', 'car',           '#f59e0b', true),
    ('Salud',           'expense', 'heart',         '#ec4899', true),
    ('Educación',       'expense', 'book',          '#6366f1', true),
    ('Ocio',            'expense', 'smile',         '#14b8a6', true),
    ('Ropa',            'expense', 'shopping-bag',  '#a855f7', true),
    ('Servicios',       'expense', 'zap',           '#64748b', true),
    ('Deudas/Créditos', 'expense', 'credit-card',   '#dc2626', true),
    ('Otros gastos',    'expense', 'more-horizontal','#78716c', true)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
    RAISE NOTICE 'FinanzasApp: base de datos inicializada correctamente';
END $$;