#!/bin/bash
# ═══════════════════════════════════════════════
# Backup automático de la base de datos QuinchosApp
# Guarda la base y las imágenes subidas
# ═══════════════════════════════════════════════

set -e

DIR_BACKUP="/opt/quinchos-api/backups"
FECHA=$(date +%Y%m%d_%H%M%S)
RETENCION_DIAS=14

mkdir -p "$DIR_BACKUP"

# ─── Base de datos ───
echo "📦 Respaldando base de datos..."
docker exec quinchos-db pg_dump -U quinchos_user quinchos | gzip > "$DIR_BACKUP/db_$FECHA.sql.gz"

PESO_DB=$(du -h "$DIR_BACKUP/db_$FECHA.sql.gz" | cut -f1)
echo "   ✓ db_$FECHA.sql.gz ($PESO_DB)"

# ─── Imágenes subidas ───
echo "🖼️  Respaldando imágenes..."
VOLUMEN=$(docker volume inspect quinchos-api_quinchos-uploads --format '{{ .Mountpoint }}' 2>/dev/null || echo "")

if [ -n "$VOLUMEN" ] && [ -d "$VOLUMEN" ]; then
    tar -czf "$DIR_BACKUP/uploads_$FECHA.tar.gz" -C "$VOLUMEN" . 2>/dev/null || true
    PESO_IMG=$(du -h "$DIR_BACKUP/uploads_$FECHA.tar.gz" | cut -f1)
    echo "   ✓ uploads_$FECHA.tar.gz ($PESO_IMG)"
else
    echo "   ⚠️  No se encontró el volumen de imágenes"
fi

# ─── Borrar backups viejos ───
BORRADOS=$(find "$DIR_BACKUP" -name "*.gz" -mtime +$RETENCION_DIAS -delete -print | wc -l)
if [ "$BORRADOS" -gt 0 ]; then
    echo "🗑️  Borrados $BORRADOS backups de más de $RETENCION_DIAS días"
fi

# ─── Resumen ───
TOTAL=$(find "$DIR_BACKUP" -name "*.gz" | wc -l)
ESPACIO=$(du -sh "$DIR_BACKUP" | cut -f1)
echo ""
echo "✅ Backup completo — $TOTAL archivos, $ESPACIO en total"
