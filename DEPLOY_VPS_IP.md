# Despliegue en VPS por IP (sin dominio)

Guía para subir FinanzasApp a una VPS con IP pública **161.132.53.51** usando solo HTTP (sin SSL ni dominio).

---

## 1. Archivos que debes configurar

### 1.1 `.env` (obligatorio)

Copia `.env.example` a `.env` y ajusta estos valores:

```bash
cp .env.example .env
nano .env
```

| Variable | Valor para IP 161.132.53.51 |
|----------|-----------------------------|
| `APP_URL` | `http://161.132.53.51` |
| `VITE_API_URL` | `http://161.132.53.51/api/v1` |
| `DOMAIN` | `161.132.53.51` (o déjalo, no se usa sin SSL) |

**Importante:** `VITE_API_URL` se incrusta en el build del frontend. Si cambias la IP después, debes reconstruir la imagen web.

Las demás variables (JWT, DB, Redis, MinIO) configúralas con valores seguros. Ejemplo mínimo:

```env
APP_URL=http://161.132.53.51
VITE_API_URL=http://161.132.53.51/api/v1
DOMAIN=161.132.53.51

# JWT (cambia por strings aleatorios largos)
JWT_SECRET=tu_secreto_muy_largo_y_aleatorio_aqui
JWT_REFRESH_SECRET=otro_secreto_diferente_para_refresh

# Base de datos
DB_NAME=finanzasapp_db
DB_USER=finanzas_user
DB_PASSWORD=tu_password_seguro

# Redis
REDIS_PASSWORD=tu_password_redis

# MinIO
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=tu_password_minio
```

---

### 1.2 Nginx

Ya existe `infra/nginx/conf.d/prod-ip.conf` para producción por IP. No hace falta cambiarlo si usas la IP 161.132.53.51.

Si usas otra IP, no hay que modificar nada: `server_name _` acepta cualquier host (IP o dominio).

---

### 1.3 CORS (API)

La API usa `APP_URL` para CORS. Si `APP_URL=http://161.132.53.51`, las peticiones desde `http://161.132.53.51` serán aceptadas. No hace falta tocar código.

---

## 2. Preparar la VPS

### 2.1 Ejecutar el script de setup (una sola vez)

En la VPS, como root:

```bash
bash scripts/vps-setup.sh
```

Esto instala Docker, configura firewall (22, 80, 443) y crea el usuario `deploy`.

### 2.2 Clonar y configurar

```bash
# Conectarse como deploy
ssh deploy@161.132.53.51

# Clonar (o subir el proyecto por otro medio)
git clone <tu-repo> /opt/finanzasapp
cd /opt/finanzasapp

# Configurar .env
cp .env.example .env
nano .env   # Ajustar APP_URL, VITE_API_URL, DOMAIN y passwords
```

---

## 3. Levantar la aplicación

```bash
cd /opt/finanzasapp

# Producción por IP (sin Certbot/SSL)
docker compose -f docker-compose.yml -f docker-compose.prod-ip.yml up -d --build
```

O añade al `Makefile`:

```makefile
prod-ip: ## Producción por IP (sin dominio)
	docker compose -f docker-compose.yml -f docker-compose.prod-ip.yml up -d --build
```

Y luego: `make prod-ip`

---

## 4. Verificar

- **App:** http://161.132.53.51  
- **Health:** http://161.132.53.51/health  

```bash
curl http://161.132.53.51/health
# {"status":"ok","service":"finanzasapp-api","time":"..."}
```

---

## 5. Resumen de archivos relevantes

| Archivo | Acción |
|---------|--------|
| `.env` | Crear desde `.env.example` y configurar `APP_URL`, `VITE_API_URL`, `DOMAIN` y passwords |
| `infra/nginx/conf.d/prod-ip.conf` | Ya creado para HTTP por IP |
| `docker-compose.prod-ip.yml` | Desactiva Certbot (no se usa sin dominio) |

---

## 6. Cuando tengas dominio

1. Apunta el dominio a la IP 161.132.53.51 (registro A).
2. Actualiza `.env`: `APP_URL=https://tudominio.com`, `VITE_API_URL=https://tudominio.com/api/v1`, `DOMAIN=tudominio.com`.
3. Copia `infra/nginx/prodd/prod.conf` a `infra/nginx/conf.d/` y ajusta `server_name` y rutas de certificados.
4. Ejecuta `make ssl` para obtener el certificado Let's Encrypt.
5. Levanta sin el override de prod-ip: `docker compose up -d --build`.
