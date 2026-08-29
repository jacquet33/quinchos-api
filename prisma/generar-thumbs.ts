import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const DIR = path.join(UPLOAD_DIR, 'quinchos');

async function main() {
  console.log('🖼️  Optimizando imágenes existentes...\n');

  const archivos = fs.readdirSync(DIR).filter(
    (f) => /\.(jpg|jpeg|png|heic)$/i.test(f) && !f.includes('_thumb')
  );

  let procesadas = 0;
  let ahorroTotal = 0;

  for (const archivo of archivos) {
    const rutaOriginal = path.join(DIR, archivo);
    const base = archivo.replace(/\.[^.]+$/, '');
    const rutaThumb = path.join(DIR, `${base}_thumb.jpg`);
    const rutaFinal = path.join(DIR, `${base}.jpg`);

    const pesoAntes = fs.statSync(rutaOriginal).size;

    try {
      const buffer = fs.readFileSync(rutaOriginal);

      // Miniatura
      if (!fs.existsSync(rutaThumb)) {
        await sharp(buffer).rotate().resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 72, progressive: true, mozjpeg: true })
          .toFile(rutaThumb);
      }

      // Versión optimizada
      const optimizada = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toBuffer();

      fs.writeFileSync(rutaFinal, optimizada);
      if (rutaOriginal !== rutaFinal) fs.unlinkSync(rutaOriginal);

      const pesoDespues = optimizada.length;
      ahorroTotal += pesoAntes - pesoDespues;
      procesadas++;

      const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
      console.log(`  ✓ ${archivo}`);
      console.log(`    ${mb(pesoAntes)} MB → ${mb(pesoDespues)} MB\n`);

      // Actualizar la URL si cambió la extensión
      if (!archivo.endsWith('.jpg')) {
        const urlVieja = { contains: archivo };
        const imgs = await prisma.quinchoImagen.findMany({ where: { url: urlVieja } });
        for (const img of imgs) {
          await prisma.quinchoImagen.update({
            where: { id: img.id },
            data: { url: img.url.replace(archivo, `${base}.jpg`) },
          });
        }
      }
    } catch (e) {
      console.log(`  ✗ ${archivo}: ${e}\n`);
    }
  }

  console.log(`✅ ${procesadas} imágenes optimizadas`);
  console.log(`   Ahorro total: ${(ahorroTotal / 1024 / 1024).toFixed(2)} MB`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
