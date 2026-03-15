#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  FinanzasApp — Obtener certificado SSL (primera vez)
#  Prerequisito: Nginx debe estar corriendo en :80
#                y el dominio debe apuntar al servidor
#  Uso: bash scripts/ssl-init.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# Leer dominio y email desde el .env
source .env 2>/dev/null || { echo "No se encontró .env"; exit 1; }

echo ""
echo "Obteniendo certificado SSL para: ${DOMAIN}"
echo "Email de contacto:               ${CERTBOT_EMAIL}"
echo ""

# Certbot usa el método "webroot":
# 1. Crea un archivo en /var/www/certbot/.well-known/acme-challenge/
# 2. Let's Encrypt lo descarga via HTTP desde el dominio
# 3. Si lo encuentra → confirma que eres el dueño → emite el certificado
docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    certbot/certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "${CERTBOT_EMAIL}" \
        --agree-tos \
        --no-eff-email \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}"

echo ""
echo "Certificado obtenido. Activando HTTPS en Nginx..."

# Reemplazar la config de dev.conf por prod.conf y recargar Nginx
docker compose exec nginx nginx -s reload

echo ""
echo "SSL activado. Tu app está disponible en https://${DOMAIN}"