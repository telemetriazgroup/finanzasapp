# ─────────────────────────────────────────────────
#  FinanzasApp Web — Dockerfile producción
#
#  Stage build:  instala dependencias y compila con Vite
#  Stage final:  Nginx sirve el HTML/JS/CSS estático
# ─────────────────────────────────────────────────

# ── Build ─────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Recibe la URL de la API como argumento de build
# Se incrusta en el bundle de Vite al compilar
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
# npm run build ejecuta: vite build → genera /app/dist
RUN npm run build

# ── Producción ────────────────────────────────────
# Imagen mínima de Nginx solo para servir archivos estáticos
FROM nginx:1.25-alpine AS production

# Copiar el build de React al directorio que sirve Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración de Nginx para SPA (todas las rutas → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]