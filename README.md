# 🔥 QuinchosAPI

Backend REST API para **QuinchosApp** — buscar, reservar y valorar quinchos y salones de eventos.

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.20-purple)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

## 🏗️ Stack

| Tecnología | Uso |
|---|---|
| **Node.js + Express** | Servidor HTTP |
| **TypeScript** | Tipado estricto |
| **Prisma ORM** | Acceso a base de datos |
| **PostgreSQL** | Base de datos relacional |
| **JWT + bcrypt** | Autenticación y seguridad |
| **Zod** | Validación de datos |
| **Helmet + CORS** | Seguridad HTTP |
| **Rate Limiter** | Protección contra abuso |

## 🚀 Setup Rápido

### 1. Clonar e instalar

```bash
git clone https://github.com/jacquet33/quinchos-api.git
cd quinchos-api
npm install
```

### 2. Base de datos PostgreSQL gratuita

Elegí una opción:

| Proveedor | Free Tier | URL |
|---|---|---|
| **Neon** (recomendado) | 0.5 GB, serverless | https://neon.tech |
| **Supabase** | 500 MB, dashboard | https://supabase.com |
| **Railway** | Trial $5 crédito | https://railway.app |
| **ElephantSQL** | 20 MB | https://elephantsql.com |

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tu connection string:

```env
DATABASE_URL="postgresql://user:pass@host:5432/quinchos?sslmode=require"
JWT_SECRET="un-secreto-largo-y-seguro-de-32-chars"
```

### 4. Crear tablas y poblar datos

```bash
# Generar cliente Prisma
npx prisma generate

# Crear tablas en la base de datos
npx prisma db push

# Poblar con datos de ejemplo (Colón, Entre Ríos)
npm run db:seed
```

### 5. Iniciar servidor

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`

## 📡 API Endpoints

### Auth
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/registro` | Crear cuenta | No |
| POST | `/api/auth/login` | Iniciar sesión | No |
| GET | `/api/auth/perfil` | Ver perfil | ✅ |
| PATCH | `/api/auth/perfil` | Actualizar perfil | ✅ |

### Quinchos
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/quinchos` | Buscar con filtros | No |
| GET | `/api/quinchos/destacados` | Top valorados | No |
| GET | `/api/quinchos/:id` | Detalle completo | No |
| POST | `/api/quinchos` | Crear espacio | Propietario |
| PATCH | `/api/quinchos/:id` | Actualizar | Propietario |
| DELETE | `/api/quinchos/:id` | Eliminar | Propietario |
| POST | `/api/quinchos/:id/favorito` | Toggle favorito | ✅ |
| GET | `/api/quinchos/usuario/favoritos` | Mis favoritos | ✅ |

### Reservas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/reservas` | Crear reserva | ✅ |
| GET | `/api/reservas/mis-reservas` | Mis reservas | ✅ |
| GET | `/api/reservas/:id` | Detalle | ✅ |
| POST | `/api/reservas/:id/cancelar` | Cancelar | ✅ |
| PATCH | `/api/reservas/:id/estado` | Confirmar/completar | Propietario |
| GET | `/api/reservas/propietario/recibidas` | Reservas recibidas | Propietario |

### Reseñas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/resenas` | Escribir reseña | ✅ |
| GET | `/api/resenas/quincho/:id` | Reseñas de un quincho | No |
| PATCH | `/api/resenas/:id/responder` | Responder reseña | Propietario |
| DELETE | `/api/resenas/:id` | Eliminar reseña | Autor/Admin |

### Parámetros de búsqueda (`GET /api/quinchos`)

```
?q=asado                    Texto libre
&tipo=QUINCHO               QUINCHO|SALON|QUINTA|TERRAZA|JARDIN|todos
&precioMin=10000            Precio mínimo por día
&precioMax=100000           Precio máximo por día
&capacidadMin=20            Capacidad mínima
&amenidades=PARRILLA,PILETA Amenidades requeridas
&ordenarPor=precio          precio|calificacion|reciente
&ciudad=Colón               Filtro por ciudad
&page=1&limit=20            Paginación
```

## 🧪 Testing rápido

```bash
# Registro
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","nombre":"Test"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"laura@gmail.com","password":"123456"}'

# Buscar quinchos
curl http://localhost:3000/api/quinchos?tipo=QUINCHO&ciudad=Colón

# Destacados
curl http://localhost:3000/api/quinchos/destacados
```

## 🗄️ Modelo de Datos

```
usuarios ──┐
            ├── quinchos (1:N propietario)
            │     ├── quincho_imagenes
            │     ├── quincho_amenidades
            │     ├── reservas
            │     └── resenas
            ├── reservas (1:N usuario)
            ├── resenas (1:N usuario)
            └── favoritos (N:M)
```

### Usuarios de prueba (seed)

| Email | Password | Rol |
|---|---|---|
| admin@quinchos.app | 123456 | ADMIN |
| carlos@quinchos.app | 123456 | PROPIETARIO |
| maria@quinchos.app | 123456 | PROPIETARIO |
| laura@gmail.com | 123456 | USUARIO |
| martin@gmail.com | 123456 | USUARIO |

## 🐳 Docker

```bash
docker build -t quinchos-api .
docker run -p 3000:3000 --env-file .env quinchos-api
```

## 📂 Estructura

```
├── prisma/
│   ├── schema.prisma     # Modelo de datos
│   └── seed.ts           # Datos de ejemplo
├── src/
│   ├── controllers/      # Lógica de negocio
│   ├── middleware/        # Auth, validación
│   ├── routes/            # Definición de rutas
│   ├── utils/             # Prisma client, errores
│   ├── validators/        # Esquemas Zod
│   ├── app.ts             # Config Express
│   └── server.ts          # Entry point
├── Dockerfile
└── .env.example
```

## 📄 Licencia

MIT
