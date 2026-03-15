#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  FinanzasApp — Despliegue en producción
#  Ejecutar desde /opt/finanzasapp como usuario deploy
#  Uso: bash scripts/deploy.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }
header() { echo -e "\n${BLUE}▶ $1${NC}"; }

# ── Verificaciones previas ────────────────────────────────
header "Verificando dependencias"
command -v docker      >/dev/null || error "Docker no instalado"
command -v git         >/dev/null || error "Git no instalado"
docker compose version >/dev/null || error "Docker Compose v2 no disponible"
[ -f ".env" ]                     || error ".env no encontrado. Copia .env.example y complétalo."
log "Todo listo"

# ── Actualizar código ─────────────────────────────────────
header "Descargando últimos cambios"
git pull origin main
log "Código actualizado en $(git log -1 --format='%h %s')"

# ── Construir nuevas imágenes ─────────────────────────────
header "Construyendo imágenes Docker"
docker compose build --no-cache
log "Imágenes construidas"

# ── Reemplazar contenedores ───────────────────────────────
# --remove-orphans elimina contenedores de servicios que ya no existen
header "Reiniciando servicios"
docker compose down --remove-orphans
docker compose up -d
log "Servicios levantados"

# ── Esperar a que la API esté lista ───────────────────────
header "Verificando salud de la API"
INTENTOS=20
ESPERA=3
until curl -sf http://localhost/health >/dev/null 2>&1; do
    if [ $INTENTOS -eq 0 ]; then
        error "La API no respondió. Revisa: docker compose logs api"
    fi
    warn "Esperando ${ESPERA}s... (intentos restantes: $INTENTOS)"
    sleep $ESPERA
    INTENTOS=$((INTENTOS - 1))
done
log "API respondiendo correctamente"

# ── Estado final ──────────────────────────────────────────
header "Estado de los contenedores"
docker compose ps

DOMINIO=$(grep "^DOMAIN=" .env | cut -d= -f2)
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗"
echo -e "║   Despliegue completado con éxito   ║"
echo -e "╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  App:    ${BLUE}https://${DOMINIO}${NC}"
echo -e "  Health: ${BLUE}https://${DOMINIO}/health${NC}"
echo -e "  Logs:   ${YELLOW}docker compose logs -f api${NC}"