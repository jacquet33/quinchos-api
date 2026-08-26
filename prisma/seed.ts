import { PrismaClient, TipoEspacio, Amenidad, Rol, EstadoReserva } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando la base de datos...');

  // ─── Limpiar tablas ───
  await prisma.favorito.deleteMany();
  await prisma.resena.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.quinchoAmenidad.deleteMany();
  await prisma.quinchoImagen.deleteMany();
  await prisma.quincho.deleteMany();
  await prisma.usuario.deleteMany();

  // ─── Usuarios ───
  const hash = await bcrypt.hash('123456', 10);

  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@quinchos.app',
      passwordHash: hash,
      nombre: 'Admin QuinchosApp',
      telefono: '+54 3447 000000',
      rol: 'ADMIN',
      verificado: true,
    },
  });

  const propietario1 = await prisma.usuario.create({
    data: {
      email: 'carlos@quinchos.app',
      passwordHash: hash,
      nombre: 'Carlos Méndez',
      telefono: '+54 3447 401234',
      rol: 'PROPIETARIO',
      verificado: true,
    },
  });

  const propietario2 = await prisma.usuario.create({
    data: {
      email: 'maria@quinchos.app',
      passwordHash: hash,
      nombre: 'María Soledad Ruiz',
      telefono: '+54 3447 405678',
      rol: 'PROPIETARIO',
      verificado: true,
    },
  });

  const propietario3 = await prisma.usuario.create({
    data: {
      email: 'jorge@quinchos.app',
      passwordHash: hash,
      nombre: 'Jorge Pereira',
      telefono: '+54 3447 409012',
      rol: 'PROPIETARIO',
      verificado: false,
    },
  });

  const propietario4 = await prisma.usuario.create({
    data: {
      email: 'ana@quinchos.app',
      passwordHash: hash,
      nombre: 'Ana Gutiérrez',
      telefono: '+54 3447 412345',
      rol: 'PROPIETARIO',
      verificado: true,
    },
  });

  const propietario5 = await prisma.usuario.create({
    data: {
      email: 'raul@quinchos.app',
      passwordHash: hash,
      nombre: 'Raúl Ibáñez',
      telefono: '+54 3447 416789',
      rol: 'PROPIETARIO',
      verificado: false,
    },
  });

  const usuario1 = await prisma.usuario.create({
    data: {
      email: 'laura@gmail.com',
      passwordHash: hash,
      nombre: 'Laura González',
      telefono: '+54 3447 501111',
      rol: 'USUARIO',
    },
  });

  const usuario2 = await prisma.usuario.create({
    data: {
      email: 'martin@gmail.com',
      passwordHash: hash,
      nombre: 'Martín Pérez',
      telefono: '+54 3447 502222',
      rol: 'USUARIO',
    },
  });

  const usuario3 = await prisma.usuario.create({
    data: {
      email: 'sofia@gmail.com',
      passwordHash: hash,
      nombre: 'Sofía Ramírez',
      telefono: '+54 3447 503333',
      rol: 'USUARIO',
    },
  });

  console.log('✅ Usuarios creados');

  // ─── Quinchos ───
  const quinchoData = [
    {
      nombre: 'Quincho Don Asado',
      descripcion: 'Amplio quincho con parrilla profesional, pileta y parque arbolado. Ideal para reuniones familiares y cumpleaños. Capacidad para 60 personas con mesas y sillas incluidas. Estacionamiento privado.',
      direccion: 'Ruta 14 Km 5, Colón',
      ciudad: 'Colón',
      provincia: 'Entre Ríos',
      latitud: -32.2249,
      longitud: -58.1411,
      precioHora: 15000,
      precioDia: 85000,
      capacidadMin: 10,
      capacidadMax: 60,
      tipo: TipoEspacio.QUINCHO,
      horarioApertura: '08:00',
      horarioCierre: '00:00',
      propietarioId: propietario1.id,
      imagenes: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
      ],
      amenidades: [
        Amenidad.PARRILLA, Amenidad.PILETA, Amenidad.ESTACIONAMIENTO,
        Amenidad.MESAS_SILLAS, Amenidad.JUEGOS_NINOS, Amenidad.TECHADO, Amenidad.BANO,
      ],
    },
    {
      nombre: 'Salón Río Paraná',
      descripcion: 'Elegante salón de eventos con vista al río. Equipado con aire acondicionado, cocina industrial y sistema de sonido profesional. Perfecto para casamientos, fiestas de 15 y eventos corporativos.',
      direccion: 'Costanera Sur 1200, Colón',
      ciudad: 'Colón',
      provincia: 'Entre Ríos',
      latitud: -32.2180,
      longitud: -58.1350,
      precioHora: 25000,
      precioDia: 150000,
      capacidadMin: 30,
      capacidadMax: 150,
      tipo: TipoEspacio.SALON,
      horarioApertura: '10:00',
      horarioCierre: '02:00',
      propietarioId: propietario2.id,
      imagenes: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
      ],
      amenidades: [
        Amenidad.AIRE_ACONDICIONADO, Amenidad.COCINA, Amenidad.ESTACIONAMIENTO,
        Amenidad.MUSICA, Amenidad.VAJILLA, Amenidad.SEGURIDAD, Amenidad.TECHADO, Amenidad.BANO,
      ],
    },
    {
      nombre: 'Quinta Los Aromos',
      descripcion: 'Hermosa quinta con quincho, pileta climatizada y amplio parque con juegos infantiles. Zona tranquila y segura. Ideal para pasar el día o el fin de semana entero con familia y amigos.',
      direccion: 'Camino al Balneario s/n, San José',
      ciudad: 'San José',
      provincia: 'Entre Ríos',
      latitud: -32.1950,
      longitud: -58.2100,
      precioHora: 12000,
      precioDia: 70000,
      capacidadMin: 5,
      capacidadMax: 40,
      tipo: TipoEspacio.QUINTA,
      horarioApertura: '08:00',
      horarioCierre: '22:00',
      propietarioId: propietario3.id,
      imagenes: [
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      ],
      amenidades: [
        Amenidad.PARRILLA, Amenidad.PILETA, Amenidad.ESTACIONAMIENTO,
        Amenidad.WIFI, Amenidad.JUEGOS_NINOS, Amenidad.BANO,
      ],
    },
    {
      nombre: 'Terraza Mirador',
      descripcion: 'Terraza panorámica en el centro de la ciudad. Espacio moderno con decoración industrial, luces LED y vista 360°. Ideal para eventos íntimos, cumpleaños y after office.',
      direccion: 'Av. 12 de Abril 450, Colón',
      ciudad: 'Colón',
      provincia: 'Entre Ríos',
      latitud: -32.2230,
      longitud: -58.1430,
      precioHora: 18000,
      precioDia: 100000,
      capacidadMin: 15,
      capacidadMax: 80,
      tipo: TipoEspacio.TERRAZA,
      horarioApertura: '16:00',
      horarioCierre: '03:00',
      propietarioId: propietario4.id,
      imagenes: [
        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
      ],
      amenidades: [
        Amenidad.WIFI, Amenidad.AIRE_ACONDICIONADO, Amenidad.MUSICA,
        Amenidad.VAJILLA, Amenidad.MESAS_SILLAS, Amenidad.BANO, Amenidad.TECHADO,
      ],
    },
    {
      nombre: 'Jardín del Palmar',
      descripcion: 'Espacioso jardín rodeado de palmeras nativas. Experiencia al aire libre con parrilla de leña y horno de barro. Un lugar único para disfrutar la naturaleza entrerriana.',
      direccion: 'Acceso Parque Nacional El Palmar, Ubajay',
      ciudad: 'Ubajay',
      provincia: 'Entre Ríos',
      latitud: -31.7900,
      longitud: -58.3100,
      precioHora: 10000,
      precioDia: 55000,
      capacidadMin: 8,
      capacidadMax: 35,
      tipo: TipoEspacio.JARDIN,
      horarioApertura: '09:00',
      horarioCierre: '20:00',
      propietarioId: propietario5.id,
      imagenes: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      ],
      amenidades: [
        Amenidad.PARRILLA, Amenidad.ESTACIONAMIENTO, Amenidad.BANO, Amenidad.MESAS_SILLAS,
      ],
    },
    {
      nombre: 'Quincho El Gaucho',
      descripcion: 'Quincho tradicional con estilo gauchesco. Parrilla para 30 personas, horno de barro y fogón. Incluye leña y carbón. Ambiente campestre a minutos del centro.',
      direccion: 'Camino Vecinal Km 3, Colón',
      ciudad: 'Colón',
      provincia: 'Entre Ríos',
      latitud: -32.2310,
      longitud: -58.1520,
      precioHora: 11000,
      precioDia: 60000,
      capacidadMin: 8,
      capacidadMax: 30,
      tipo: TipoEspacio.QUINCHO,
      horarioApertura: '09:00',
      horarioCierre: '23:00',
      propietarioId: propietario1.id,
      imagenes: [
        'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800',
      ],
      amenidades: [
        Amenidad.PARRILLA, Amenidad.ESTACIONAMIENTO, Amenidad.BANO,
        Amenidad.MESAS_SILLAS, Amenidad.TECHADO,
      ],
    },
  ];

  const quinchos = [];
  for (const data of quinchoData) {
    const { imagenes, amenidades, ...quinchoFields } = data;
    const quincho = await prisma.quincho.create({
      data: {
        ...quinchoFields,
        imagenes: {
          create: imagenes.map((url, i) => ({ url, orden: i })),
        },
        amenidades: {
          create: amenidades.map((a) => ({ amenidad: a })),
        },
      },
    });
    quinchos.push(quincho);
  }

  console.log('✅ Quinchos creados:', quinchos.length);

  // ─── Reservas ───
  const reserva1 = await prisma.reserva.create({
    data: {
      fecha: new Date('2026-09-15'),
      horaInicio: '12:00',
      horaFin: '20:00',
      cantidadPersonas: 25,
      precioTotal: 85000,
      estado: EstadoReserva.CONFIRMADA,
      notas: 'Cumpleaños de 15',
      usuarioId: usuario1.id,
      quinchoId: quinchos[0].id,
    },
  });

  const reserva2 = await prisma.reserva.create({
    data: {
      fecha: new Date('2026-08-10'),
      horaInicio: '10:00',
      horaFin: '18:00',
      cantidadPersonas: 15,
      precioTotal: 70000,
      estado: EstadoReserva.COMPLETADA,
      notas: 'Reunión familiar',
      usuarioId: usuario2.id,
      quinchoId: quinchos[2].id,
    },
  });

  const reserva3 = await prisma.reserva.create({
    data: {
      fecha: new Date('2026-10-20'),
      horaInicio: '20:00',
      horaFin: '02:00',
      cantidadPersonas: 80,
      precioTotal: 150000,
      estado: EstadoReserva.PENDIENTE,
      notas: 'Casamiento',
      usuarioId: usuario3.id,
      quinchoId: quinchos[1].id,
    },
  });

  console.log('✅ Reservas creadas');

  // ─── Reseñas ───
  await prisma.resena.create({
    data: {
      calificacion: 5,
      comentario: 'Excelente lugar, muy limpio y bien equipado. La parrilla es de primer nivel. Volvemos seguro!',
      usuarioId: usuario1.id,
      quinchoId: quinchos[0].id,
    },
  });

  await prisma.resena.create({
    data: {
      calificacion: 4,
      comentario: 'Muy lindo, la pileta estaba genial. Solo faltó un poco más de sombra en el parque.',
      usuarioId: usuario2.id,
      quinchoId: quinchos[0].id,
    },
  });

  await prisma.resena.create({
    data: {
      calificacion: 5,
      comentario: 'Celebramos nuestro casamiento acá y fue perfecto. La vista al río es increíble y el salón es hermoso.',
      usuarioId: usuario3.id,
      quinchoId: quinchos[1].id,
    },
  });

  await prisma.resena.create({
    data: {
      calificacion: 5,
      comentario: 'Increíble la terraza, las vistas de noche son espectaculares. El sonido también muy bueno.',
      usuarioId: usuario1.id,
      quinchoId: quinchos[3].id,
    },
  });

  await prisma.resena.create({
    data: {
      calificacion: 4,
      comentario: 'La quinta es hermosa, los chicos la pasaron genial con los juegos. La pileta climatizada fue un golazo.',
      usuarioId: usuario2.id,
      quinchoId: quinchos[2].id,
      reservaId: reserva2.id,
    },
  });

  // Actualizar promedios
  for (const q of quinchos) {
    const agg = await prisma.resena.aggregate({
      where: { quinchoId: q.id },
      _avg: { calificacion: true },
      _count: true,
    });
    await prisma.quincho.update({
      where: { id: q.id },
      data: {
        calificacionProm: agg._avg.calificacion ?? 0,
        totalResenas: agg._count,
      },
    });
  }

  console.log('✅ Reseñas creadas y promedios actualizados');

  // ─── Favoritos ───
  await prisma.favorito.create({
    data: { usuarioId: usuario1.id, quinchoId: quinchos[1].id },
  });
  await prisma.favorito.create({
    data: { usuarioId: usuario2.id, quinchoId: quinchos[0].id },
  });

  console.log('✅ Favoritos creados');
  console.log('🎉 Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
