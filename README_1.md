# FinanzasApp

Aplicación web y móvil para gestión personal de finanzas: ingresos, gastos, liquidez, deudas y proyecciones.

## Stack

| Capa | Tecnología |
|---|---|
| API | Node.js 20 + Express |
| Base de datos | PostgreSQL 16 |
| Cache / Sesiones | Redis 7 |
| Archivos | MinIO (S3-compatible) |
| Frontend web | React + Vite + TailwindCSS |
| Mobile | React Native (Expo) |
| Proxy / SSL | Nginx + Let's Encrypt |
| Infra | Docker Compose |

---

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar el repositorio
git clone <repo> finanzasapp && cd finanzasapp

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (mínimo: contraseñas de DB y JWT secrets)

# 3. Levantar con hot-reload
make dev

# 4. Verificar que todo funciona
make health
# → { "status": "ok", "service": "finanzasapp-api" }
```

La API queda disponible en `http://localhost/api/v1`

---

## Despliegue en VPS (DigitalOcean / Linode)

```bash
# En el servidor (como root)
bash scripts/vps-setup.sh

# Cambiar al usuario deploy
su - deploy
git clone <repo> /opt/finanzasapp
cd /opt/finanzasapp

# Configurar .env con valores de producción
cp .env.example .env && nano .env

# Levantar Nginx en HTTP primero (para challenge SSL)
make prod

# Obtener certificado SSL
make ssl

# Recargar Nginx con HTTPS
docker compose exec nginx nginx -s reload
```

---

## Endpoints de la API

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/register` | Registro de usuario |
| POST | `/api/v1/auth/login` | Login — devuelve access + refresh token |
| POST | `/api/v1/auth/refresh` | Renovar access token |
| POST | `/api/v1/auth/logout` | Invalidar sesión |
| GET | `/api/v1/auth/me` | Perfil del usuario autenticado |

### Transacciones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/transactions` | Listar (paginado, filtros) |
| POST | `/api/v1/transactions` | Crear ingreso o gasto |
| PUT | `/api/v1/transactions/:id` | Actualizar |
| DELETE | `/api/v1/transactions/:id` | Eliminar |

### Cuentas y Liquidez
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/accounts` | Listar cuentas + totales por tipo |
| POST | `/api/v1/accounts` | Crear cuenta (banco, inversión, efectivo) |
| PUT | `/api/v1/accounts/:id` | Actualizar saldo / datos |

### Deudas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/debts` | Listar deudas activas |
| POST | `/api/v1/debts` | Registrar deuda |
| GET | `/api/v1/debts/:id/projection` | Tabla de amortización mensual |

### Analytics
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/analytics/summary?period=monthly` | Resumen ingresos/gastos/balance |
| GET | `/api/v1/analytics/by-category` | Desglose por categoría |
| GET | `/api/v1/analytics/projection?months=6` | Proyección de flujo de caja |
| GET | `/api/v1/analytics/net-worth` | Patrimonio neto (activos - deudas) |
| GET | `/api/v1/analytics/cash-flow?weeks=4` | Flujo día a día |

---

## Comandos Make

```bash
make help         # Ver todos los comandos disponibles
make dev          # Desarrollo con hot-reload
make prod         # Producción
make down         # Detener
make logs-api     # Ver logs de la API
make db-shell     # Conectar a PostgreSQL
make redis-shell  # Conectar a Redis
make db-backup    # Backup de la base de datos
make deploy       # Desplegar en VPS
make health       # Verificar estado de la API
```

---

## Estructura del proyecto

```
finanzasapp/
├── api/                    # Backend Node.js
│   ├── src/
│   │   ├── controllers/    # Lógica de negocio
│   │   ├── middleware/     # Auth JWT, validación
│   │   ├── routes/         # Definición de endpoints
│   │   └── utils/          # DB, Redis, Logger
│   └── Dockerfile
├── web/                    # Frontend React (Etapa 4)
│   └── Dockerfile
├── mobile/                 # React Native Expo (Etapa 4)
├── infra/
│   ├── nginx/              # Config Nginx + SSL
│   └── postgres/           # init.sql con esquema completo
├── scripts/
│   ├── deploy.sh           # Despliegue en VPS
│   ├── vps-setup.sh        # Setup inicial del servidor
│   └── ssl-init.sh         # Certificado Let's Encrypt
├── docker-compose.yml      # Producción
├── docker-compose.dev.yml  # Override para desarrollo
├── Makefile                # Comandos del proyecto
└── .env.example            # Variables de entorno documentadasxx
```

---

## Etapas del desarrollo

- [x] **Etapa 1** — Docker + Auth + Base de datos + Infraestructura
- [ ] **Etapa 2** — Transacciones completas + UI web básica
- [ ] **Etapa 3** — Liquidez, bancos, inversiones y deudas (UI)
- [ ] **Etapa 4** — Dashboard, gráficas y proyecciones visuales
- [ ] **Etapa 5** — Notificaciones, CI/CD y monitoreo