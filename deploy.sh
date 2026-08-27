#!/bin/bash
set -e

echo "🔥 QuinchosAPI - Deploy en VPS (Traefik existente)"
echo "===================================================="

APP_DIR="/opt/quinchos-api"
REPO="https://github.com/jacquet33/quinchos-api.git"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ─── 1. Clonar / Actualizar ───
echo -e "${YELLOW}📥 Descargando código...${NC}"
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi
echo -e "${GREEN}✅ Código listo${NC}"

# ─── 2. Variables de entorno ───
if [ ! -f "$APP_DIR/.env" ]; then
    PG_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SEC=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

    cat > "$APP_DIR/.env" << ENVFILE
POSTGRES_PASSWORD=${PG_PASS}
JWT_SECRET=${JWT_SEC}
ENVFILE

    echo -e "${GREEN}✅ .env generado${NC}"
    echo -e "${YELLOW}   PG Pass: ${PG_PASS}${NC}"
else
    echo -e "${GREEN}✅ .env existente conservado${NC}"
fi

# ─── 3. Verificar red traefik-public ───
if ! docker network ls | grep -q traefik-public; then
    echo -e "${RED}❌ Red 'traefik-public' no encontrada. Verificá tu Traefik.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Red traefik-public encontrada${NC}"

# ─── 4. Build y levantar ───
echo -e "${YELLOW}🐳 Construyendo imagen...${NC}"
cd "$APP_DIR"
docker compose down 2>/dev/null || true
docker compose build --no-cache quinchos-api
docker compose up -d

echo -e "${YELLOW}⏳ Esperando que PostgreSQL arranque...${NC}"
sleep 12

# ─── 5. Migraciones ───
echo -e "${YELLOW}🗄️  Creando tablas...${NC}"
docker compose exec -T quinchos-api npx prisma db push --accept-data-loss

# ─── 6. Seed ───
echo -e "${YELLOW}🌱 Cargando datos de ejemplo...${NC}"
docker compose exec -T quinchos-api npx tsx prisma/seed.ts || \
    echo -e "${YELLOW}⚠️  Seed ya ejecutado previamente${NC}"

# ─── 7. Verificar ───
echo -e "${YELLOW}🔍 Verificando...${NC}"
sleep 5
docker compose ps

echo ""
if docker compose exec -T quinchos-api wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${YELLOW}⏳ Esperando un poco más...${NC}"
    sleep 10
    if docker compose exec -T quinchos-api wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q '"ok":true'; then
        echo -e "${GREEN}✅ API funcionando${NC}"
    else
        echo -e "${RED}⚠️  Revisá logs: docker compose -f /opt/quinchos-api/docker-compose.yml logs api${NC}"
    fi
fi

echo ""
echo "════════════════════════════════════════════"
echo -e "${GREEN}🔥 DEPLOY COMPLETADO${NC}"
echo "════════════════════════════════════════════"
echo ""
echo "  URL: https://quinchos.art3d-studio.com.ar"
echo ""
echo "  Probar:"
echo "    curl https://quinchos.art3d-studio.com.ar/api/health"
echo "    curl https://quinchos.art3d-studio.com.ar/api/quinchos"
echo "    curl https://quinchos.art3d-studio.com.ar/api/quinchos/mapa?lat=-32.22&lng=-58.14&radio=30"
echo ""
echo "  Usuarios (pass: 123456):"
echo "    laura@gmail.com     (USUARIO)"
echo "    carlos@quinchos.app (PROPIETARIO)"
echo "    admin@quinchos.app  (ADMIN)"
echo ""
echo "  Logs:     cd /opt/quinchos-api && docker compose logs -f quinchos-api"
echo "  Restart:  cd /opt/quinchos-api && docker compose restart quinchos-api"
echo "════════════════════════════════════════════"
