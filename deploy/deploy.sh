#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════
# QuinchosAPI - Script de deploy para Hostinger VPS Debian
# ═══════════════════════════════════════════════════════

echo "🔥 QuinchosAPI - Deploy en VPS"
echo "================================"

# ─── Colores ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ─── Variables ───
APP_DIR="/opt/quinchos-api"
DOMAIN="quinchos.art3d-studio.com.ar"
REPO="https://github.com/jacquet33/quinchos-api.git"

# ═══════════════════
# 1. DEPENDENCIAS
# ═══════════════════
echo -e "${YELLOW}📦 Verificando dependencias...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker no encontrado. Instalando...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose no encontrado. Instalando...${NC}"
    apt-get update && apt-get install -y docker-compose-plugin
fi

if ! command -v git &> /dev/null; then
    apt-get update && apt-get install -y git
fi

echo -e "${GREEN}✅ Dependencias OK${NC}"

# ═══════════════════
# 2. FIREWALL
# ═══════════════════
echo -e "${YELLOW}🔒 Configurando firewall...${NC}"

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw --force enable
    echo -e "${GREEN}✅ Firewall configurado (22, 80, 443)${NC}"
else
    # Debian sin ufw, usar iptables
    apt-get install -y ufw
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✅ UFW instalado y configurado${NC}"
fi

# ═══════════════════
# 3. CLONAR / ACTUALIZAR
# ═══════════════════
echo -e "${YELLOW}📥 Descargando código...${NC}"

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
    echo -e "${GREEN}✅ Código actualizado${NC}"
else
    git clone "$REPO" "$APP_DIR"
    cd "$APP_DIR"
    echo -e "${GREEN}✅ Código clonado${NC}"
fi

# ═══════════════════
# 4. CONFIGURACIÓN
# ═══════════════════
echo -e "${YELLOW}⚙️  Configurando variables de entorno...${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    # Generar passwords seguros
    PG_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SEC=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

    cat > "$APP_DIR/.env" << ENVEOF
POSTGRES_PASSWORD=${PG_PASS}
JWT_SECRET=${JWT_SEC}
DOMAIN=${DOMAIN}
ENVEOF

    echo -e "${GREEN}✅ .env generado con passwords seguros${NC}"
    echo -e "${YELLOW}   PostgreSQL password: ${PG_PASS}${NC}"
    echo -e "${YELLOW}   JWT secret generado automáticamente${NC}"
else
    echo -e "${GREEN}✅ .env ya existe, conservando configuración${NC}"
fi

# ═══════════════════
# 5. DIRECTORIO TRAEFIK
# ═══════════════════
mkdir -p "$APP_DIR/traefik/letsencrypt"
touch "$APP_DIR/traefik/letsencrypt/acme.json"
chmod 600 "$APP_DIR/traefik/letsencrypt/acme.json"

# ═══════════════════
# 6. BUILD & UP
# ═══════════════════
echo -e "${YELLOW}🐳 Construyendo y levantando servicios...${NC}"

cd "$APP_DIR"
docker compose down 2>/dev/null || true
docker compose build --no-cache api
docker compose up -d

echo -e "${YELLOW}⏳ Esperando que PostgreSQL arranque...${NC}"
sleep 10

# ═══════════════════
# 7. MIGRACIONES + SEED
# ═══════════════════
echo -e "${YELLOW}🗄️  Ejecutando migraciones...${NC}"

docker compose exec -T api npx prisma db push --accept-data-loss 2>/dev/null || \
docker compose exec -T api sh -c "npx prisma db push --accept-data-loss"

echo -e "${YELLOW}🌱 Sembrando datos iniciales...${NC}"
docker compose exec -T api npx tsx prisma/seed.ts 2>/dev/null || \
docker compose exec -T api sh -c "npx tsx prisma/seed.ts" || \
echo -e "${YELLOW}⚠️  Seed ya ejecutado o falló (puede ignorarse)${NC}"

# ═══════════════════
# 8. VERIFICAR
# ═══════════════════
echo ""
echo -e "${YELLOW}🔍 Verificando servicios...${NC}"
sleep 5

docker compose ps

echo ""

# Test health endpoint
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API respondiendo en localhost:3000${NC}"
else
    echo -e "${YELLOW}⏳ API todavía arrancando, esperando 15s más...${NC}"
    sleep 15
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API respondiendo en localhost:3000${NC}"
    else
        echo -e "${RED}❌ API no responde. Revisá logs: docker compose logs api${NC}"
    fi
fi

# ═══════════════════
# 9. RESUMEN
# ═══════════════════
echo ""
echo "════════════════════════════════════════════"
echo -e "${GREEN}🔥 DEPLOY COMPLETADO${NC}"
echo "════════════════════════════════════════════"
echo ""
echo -e "  API URL:     ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Health:      https://${DOMAIN}/api/health"
echo -e "  Quinchos:    https://${DOMAIN}/api/quinchos"
echo -e "  Mapa:        https://${DOMAIN}/api/quinchos/mapa"
echo ""
echo "  Usuarios de prueba (password: 123456):"
echo "    - laura@gmail.com     (USUARIO)"
echo "    - carlos@quinchos.app (PROPIETARIO)"
echo "    - admin@quinchos.app  (ADMIN)"
echo ""
echo "  Comandos útiles:"
echo "    docker compose logs -f api     # Ver logs"
echo "    docker compose restart api     # Reiniciar API"
echo "    docker compose down            # Parar todo"
echo "    docker compose up -d           # Levantar todo"
echo "════════════════════════════════════════════"
