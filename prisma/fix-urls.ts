import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://quinchos.art3d-studio.com.ar').replace(/\/$/, '');

async function main() {
  console.log('🔧 Corrigiendo URLs de imágenes...\n');

  // Imágenes de quinchos con http://
  const imagenes = await prisma.quinchoImagen.findMany({
    where: { url: { startsWith: 'http://' } },
  });

  for (const img of imagenes) {
    const archivo = img.url.split('/').pop();
    const nuevaUrl = `${PUBLIC_URL}/uploads/quinchos/${archivo}`;
    await prisma.quinchoImagen.update({
      where: { id: img.id },
      data: { url: nuevaUrl },
    });
    console.log(`  ✓ ${img.url}\n    → ${nuevaUrl}\n`);
  }

  // Avatares con http://
  const usuarios = await prisma.usuario.findMany({
    where: { avatar: { startsWith: 'http://' } },
  });

  for (const u of usuarios) {
    const archivo = u.avatar!.split('/').pop();
    const nuevaUrl = `${PUBLIC_URL}/uploads/quinchos/${archivo}`;
    await prisma.usuario.update({
      where: { id: u.id },
      data: { avatar: nuevaUrl },
    });
    console.log(`  ✓ avatar de ${u.nombre} corregido`);
  }

  console.log(`\n✅ Listo: ${imagenes.length} imágenes y ${usuarios.length} avatares corregidos`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
