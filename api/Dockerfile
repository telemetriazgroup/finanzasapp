# ─────────────────────────────────────────────────
#  FinanzasApp API — Dockerfile multi-stage
#
#  Stages:
#    base        → imagen base compartida
#    development → hot-reload con nodemon
#    production  → imagen mínima, usuario no-root
# ─────────────────────────────────────────────────

# ── Stage base ────────────────────────────────────
# Node 20 Alpine: imagen pequeña (~50MB vs ~300MB en Debian)
FROM node:20-alpine AS base
WORKDIR /app

# dumb-init: maneja señales del SO correctamente dentro de Docker
# curl: necesario para el healthcheck
RUN apk add --no-cache dumb-init curl

COPY package*.json ./

# ── Stage development ─────────────────────────────
# Instala TODAS las dependencias (incluyendo devDependencies como nodemon)
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── Stage production ──────────────────────────────
# Solo instala dependencias de producción
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .

# Crear usuario sin privilegios — buena práctica de seguridad
# Los procesos de la app NO corren como root
RUN addgroup -g 1001 -S nodejs \
 && adduser  -S nodeuser -u 1001 -G nodejs
USER nodeuser

EXPOSE 4000

# dumb-init como entrypoint maneja SIGTERM correctamente
# (Docker lo envía al hacer docker stop)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]