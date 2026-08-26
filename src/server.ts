import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './utils/prisma';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  // Verificar conexión a la base de datos
  try {
    await prisma.$connect();
    console.log('✅ Conectado a PostgreSQL');
  } catch (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`
🔥 QuinchosAPI corriendo en http://localhost:${PORT}
📖 Endpoints:
   POST   /api/auth/registro
   POST   /api/auth/login
   GET    /api/auth/perfil
   GET    /api/quinchos
   GET    /api/quinchos/destacados
   GET    /api/quinchos/:id
   POST   /api/quinchos                  (propietario)
   POST   /api/quinchos/:id/favorito     (auth)
   GET    /api/quinchos/usuario/favoritos (auth)
   POST   /api/reservas                  (auth)
   GET    /api/reservas/mis-reservas     (auth)
   POST   /api/reservas/:id/cancelar     (auth)
   PATCH  /api/reservas/:id/estado       (propietario)
   POST   /api/resenas                   (auth)
   GET    /api/resenas/quincho/:id
   PATCH  /api/resenas/:id/responder     (propietario)
    `);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();
