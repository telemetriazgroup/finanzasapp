#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  FinanzasApp — Configuración inicial del VPS
#  Sistema: Ubuntu 22.04 / 24.04 LTS
#  Ejecutar como root: bash scripts/vps-setup.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ── Colores para el output ────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }
header() { echo -e "\n${BLUE}▶ $1${NC}"; }

# ── 1. Actualizar el sistema ──────────────────────────────
header "Actualizando paquetes del sistema"
apt-get update -qq
apt-get upgrade -y -qq
log "Sistema actualizado"

# ── 2. Instalar dependencias base ─────────────────────────
header "Instalando utilidades"
apt-get install -y -qq curl git ufw fail2ban unzip
log "Utilidades instaladas"

# ── 3. Instalar Docker ────────────────────────────────────
header "Instalando Docker"
if ! command -v docker &>/dev/null; then
    # Script oficial de Docker — instala la última versión estable
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker instalado: $(docker --version)"
else
    log "Docker ya presente: $(docker --version)"
fi

# ── 4. Instalar Docker Compose v2 ─────────────────────────
header "Instalando Docker Compose v2"
COMPOSE_VERSION=$(curl -s \
    https://api.github.com/repos/docker/compose/releases/latest \
    | grep '"tag_name"' | cut -d'"' -f4)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
log "Docker Compose ${COMPOSE_VERSION} instalado"

# ── 5. Configurar firewall UFW ────────────────────────────
header "Configurando firewall"
ufw --force reset
ufw default deny incoming    # Bloquear todo por defecto
ufw default allow outgoing
ufw allow 22/tcp  comment "SSH"
ufw allow 80/tcp  comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
log "Firewall activo (22, 80, 443)"

# ── 6. Configurar Fail2ban ────────────────────────────────
# Fail2ban bloquea IPs que intentan hacer brute-force en SSH
header "Configurando Fail2ban"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600    # Banear por 1 hora
findtime = 600     # Ventana de detección: 10 minutos
maxretry = 5       # Máximo 5 intentos fallidos

[sshd]
enabled = true
EOF
systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2ban activo"

# ── 7. Crear usuario no-root para despliegues ─────────────
# Nunca se despliega como root — usamos el usuario "deploy"
header "Creando usuario 'deploy'"
if ! id "deploy" &>/dev/null; then
    adduser --disabled-password --gecos "" deploy
    usermod -aG docker deploy   # Permite usar docker sin sudo
    # Copiar llaves SSH del root para poder conectarse como deploy
    mkdir -p /home/deploy/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
    fi
    log "Usuario 'deploy' creado"
else
    log "Usuario 'deploy' ya existe"
fi

# ── 8. Preparar directorios del proyecto ──────────────────
header "Preparando directorios"
mkdir -p /opt/finanzasapp      # Aquí va el código del proyecto
mkdir -p /var/log/app          # Logs de la aplicación
mkdir -p /var/www/certbot      # Challenge de Let's Encrypt
chown deploy:deploy /opt/finanzasapp
chown deploy:deploy /var/log/app
log "Directorios listos"

# ── Resumen final ─────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗"
echo -e "║   VPS listo para FinanzasApp  ✔     ║"
echo -e "╚══════════════════════════════════════╝${NC}"
echo ""
echo "  Próximos pasos:"
echo "  1. Conectarse como usuario deploy:"
echo -e "     ${YELLOW}ssh deploy@<IP_DEL_SERVIDOR>${NC}"
echo "  2. Clonar el repositorio:"
echo -e "     ${YELLOW}git clone <repo> /opt/finanzasapp${NC}"
echo "  3. Configurar variables de entorno:"
echo -e "     ${YELLOW}cp .env.example .env && nano .env${NC}"
echo "  4. Levantar la app:"
echo -e "     ${YELLOW}make prod${NC}"
echo "  5. Obtener SSL:"
echo -e "     ${YELLOW}make ssl${NC}"