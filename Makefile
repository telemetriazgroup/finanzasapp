# ─────────────────────────────────────────────────────
#  FinanzasApp — Makefile
#  Uso: make <comando>   Ej: make dev
# ─────────────────────────────────────────────────────

GREEN  := \033[0;32m
YELLOW := \033[1;33m
NC     := \033[0m

.PHONY: help dev prod down logs ps build clean db-shell redis-shell ssl deploy health db-backup

help: ## Muestra esta ayuda
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?##"}; {printf "  $(GREEN)%-16s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ── Desarrollo ────────────────────────────────────────
dev: ## Levantar con hot-reload (API + Web)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-d: ## Levantar desarrollo en background
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# ── Producción ────────────────────────────────────────
prod: ## Levantar entorno de producción
	docker compose up -d --build

# ── Control básico ────────────────────────────────────
down: ## Detener todos los contenedores
	docker compose down

restart: ## Reiniciar todos los servicios
	docker compose restart

build: ## Reconstruir imágenes sin cache
	docker compose build --no-cache

# ── Observabilidad ────────────────────────────────────
logs: ## Ver logs de todos los servicios
	docker compose logs -f

logs-api: ## Ver solo logs de la API
	docker compose logs -f api

ps: ## Estado de los contenedores
	docker compose ps

health: ## Verificar que la API responde
	@curl -sf http://localhost/health | python3 -m json.tool

# ── Shells ────────────────────────────────────────────
api-shell: ## Abrir shell en el contenedor API
	docker compose exec api sh

db-shell: ## Conectarse a PostgreSQL
	docker compose exec postgres psql \
	  -U $$(grep DB_USER .env | cut -d= -f2) \
	  -d $$(grep DB_NAME .env | cut -d= -f2)

redis-shell: ## Conectarse a Redis CLI
	docker compose exec redis \
	  redis-cli -a $$(grep REDIS_PASSWORD .env | cut -d= -f2)

# ── Base de datos ─────────────────────────────────────
db-backup: ## Hacer backup de PostgreSQL
	@mkdir -p backups
	docker compose exec postgres pg_dump \
	  -U $$(grep DB_USER .env | cut -d= -f2) \
	  $$(grep DB_NAME .env | cut -d= -f2) \
	  > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup guardado en backups/$(NC)"

# ── Despliegue ────────────────────────────────────────
ssl: ## Obtener certificado SSL (primera vez)
	bash scripts/ssl-init.sh

deploy: ## Desplegar en VPS
	bash scripts/deploy.sh

vps-setup: ## Configurar VPS desde cero
	bash scripts/vps-setup.sh

# ── Limpieza ──────────────────────────────────────────
clean: ## Eliminar imágenes y contenedores huérfanos
	docker system prune -f