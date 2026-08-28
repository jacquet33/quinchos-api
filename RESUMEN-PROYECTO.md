# QuinchosApp — Resumen Completo del Proyecto

## 🏗️ Ecosistema (3 repositorios)

| Repo | Stack | URL |
|---|---|---|
| **quinchos-api** | Node.js + Express + TypeScript + Prisma + PostgreSQL | github.com/jacquet33/quinchos-api |
| **quinchos-ios** | Swift 5.9 + SwiftUI + MVVM (iOS 16+) | github.com/jacquet33/quinchos-ios |
| **quinchos-android** | Kotlin 2.0 + Jetpack Compose + Hilt (SDK 26+) | github.com/jacquet33/quinchos-android |

---

## 🖥️ BACKEND — quinchos-api

### Infraestructura
- **Desplegado en:** VPS Hostinger (Debian) — Docker Compose
- **URL producción:** https://quinchos.art3d-studio.com.ar
- **Contenedores:** quinchos-db (PostgreSQL 16) + quinchos-api (Node.js 20)
- **SSL:** Let's Encrypt via Traefik existente (red traefik-public)
- **Dominio:** quinchos.art3d-studio.com.ar (DNS Cloudflare → VPS)

### Base de Datos (8 tablas)
- `usuarios` — email, nombre, teléfono, rol, verificado
- `quinchos` — nombre, dirección, coordenadas GPS, precios, capacidad, tipo
- `quincho_imagenes` — URLs de fotos con orden
- `quincho_amenidades` — parrilla, pileta, wifi, etc. (13 opciones)
- `reservas` — fecha, horario, personas, precio, estado, motivo cancelación
- `resenas` — calificación 1-5, comentario, respuesta del propietario
- `favoritos` — relación usuario-quincho
- `agenda_dias` — horarios y precios por día de semana
- `bloqueo_fechas` — fechas bloqueadas con motivo

### Roles (3)
| Rol | Puede hacer |
|---|---|
| **USUARIO** | Buscar, reservar, reseñar, favoritos |
| **PROPIETARIO** | Todo de usuario + ABM quinchos, agenda, confirmar/rechazar reservas, dashboard, ver clientes |
| **ADMIN** | Todo |

### Endpoints (35+)

**Auth (4)**
- POST `/api/auth/registro` — Crear cuenta
- POST `/api/auth/login` — Iniciar sesión (devuelve JWT)
- GET `/api/auth/perfil` — Ver perfil
- PATCH `/api/auth/perfil` — Actualizar perfil

**Quinchos ABM (10)**
- GET `/api/quinchos` — Búsqueda con filtros + proximidad + costos
- GET `/api/quinchos/destacados` — Top valorados
- GET `/api/quinchos/mapa` — Marcadores con coordenadas y distancia
- GET `/api/quinchos/:id` — Detalle + quinchos cercanos
- POST `/api/quinchos` — ALTA (propietario)
- PUT `/api/quinchos/:id` — MODIFICACIÓN (propietario)
- DELETE `/api/quinchos/:id` — BAJA soft/hard (propietario)
- POST `/api/quinchos/:id/reactivar` — Reactivar (propietario)
- POST `/api/quinchos/:id/imagenes` — Agregar fotos
- DELETE `/api/quinchos/:id/imagenes/:x` — Eliminar foto

**Búsqueda avanzada** (parámetros de GET /api/quinchos)
- `q` — texto libre (nombre, ciudad, dirección, descripción)
- `tipo` — QUINCHO, SALON, QUINTA, TERRAZA, JARDIN
- `precioMin`, `precioMax` — filtro costo por día
- `precioHoraMin`, `precioHoraMax` — filtro costo por hora
- `capacidadMin` — mínimo personas
- `amenidades` — comma separated (AND)
- `lat`, `lng`, `radio` — proximidad GPS (Haversine, km)
- `ordenarPor` — precio_asc, precio_desc, calificacion, distancia, reciente
- `ciudad` — filtro por ciudad
- `page`, `limit` — paginación

**Agenda / Disponibilidad (7)**
- GET `/api/agenda/:id/agenda` — Horarios semanales
- PUT `/api/agenda/:id/agenda` — Configurar 7 días (propietario)
- PATCH `/api/agenda/:id/agenda/:dia` — Actualizar un día
- GET `/api/agenda/:id/disponibilidad?mes=9&anio=2026` — Calendario mensual
- GET `/api/agenda/:id/bloqueos` — Fechas bloqueadas
- POST `/api/agenda/:id/bloqueos` — Bloquear fechas
- DELETE `/api/agenda/:id/bloqueos/:fecha` — Desbloquear

**Reservas (9)**
- POST `/api/reservas` — Crear (verifica bloqueos, agenda, conflictos)
- GET `/api/reservas/mis-reservas` — Mis reservas (usuario)
- GET `/api/reservas/:id` — Detalle
- POST `/api/reservas/:id/cancelar` — Cancelar (usuario)
- GET `/api/reservas/propietario/recibidas` — Reservas recibidas (propietario)
- GET `/api/reservas/propietario/quincho/:id` — Por quincho y rango de fechas
- POST `/api/reservas/:id/confirmar` — Confirmar (propietario)
- POST `/api/reservas/:id/rechazar` — Rechazar con motivo (propietario)
- POST `/api/reservas/:id/completar` — Marcar completada (propietario)

**Reseñas (4)**
- POST `/api/resenas` — Escribir reseña (1-5 estrellas + comentario)
- GET `/api/resenas/quincho/:id` — Reseñas de un quincho
- PATCH `/api/resenas/:id/responder` — Responder (propietario)
- DELETE `/api/resenas/:id` — Eliminar (autor o admin)

**Dashboard Propietario (4)**
- GET `/api/dashboard` — Resumen: ingresos, reservas, próximas citas, reseñas
- GET `/api/dashboard/clientes` — Lista de clientes agrupados
- GET `/api/dashboard/clientes/:id` — Detalle de un cliente
- GET `/api/dashboard/quincho/:id` — Estadísticas por quincho

**Favoritos (2)**
- POST `/api/quinchos/:id/favorito` — Toggle favorito
- GET `/api/quinchos/usuario/favoritos` — Mis favoritos

### Seguridad
- JWT con expiración 7 días
- Bcrypt para passwords
- Helmet (headers de seguridad)
- CORS configurado
- Rate limiting (200 req/15min)
- Zod validación en todos los inputs
- Verificación de propiedad en cada operación

### Datos de prueba (seed)
- 9 usuarios (3 propietarios, 3 usuarios, 1 admin)
- 6 quinchos en zona Colón/San José/Ubajay
- Reservas, reseñas, favoritos, agenda semanal

---

## 🍎 iOS — quinchos-ios

### Arquitectura
- **SwiftUI** + **MVVM** con `@MainActor` y `async/await`
- **URLSession** nativa (sin dependencias de networking)
- **Kingfisher** para cache de imágenes
- **MapKit** para mapa nativo
- **CoreLocation** para GPS

### Pantallas (8)
| Pantalla | Descripción |
|---|---|
| **Login/Registro** | Email + password, toggle login/registro |
| **Explorar** | Búsqueda, filtros por tipo, destacados, listado |
| **Detalle Quincho** | Galería fotos, precios, amenidades, propietario, reseñas, quinchos cercanos |
| **Reservar** | Formulario: fecha, horario, personas, notas, resumen de precio |
| **Mapa** | MapKit con marcadores y precios |
| **Mis Reservas** | Lista con estado, cancelar, valorar |
| **Favoritos** | Quinchos guardados |
| **Cuenta** | Perfil, settings, logout |

### Componentes reutilizables
- QuinchoCard (normal y compacto)
- StarRating (lectura y editable)
- SearchBar
- FilterChips (tipos de espacio)
- EstadoBadge (reserva)
- LocationBanner (pedir GPS / ir a Ajustes)
- DistanciaChip (km/metros)
- RadioSelector (5/10/20/50/100 km)
- AmenidadChip, InfoPill, FlowLayout

### ViewModels (5)
- AuthViewModel — login, registro, perfil, logout
- QuinchosViewModel — búsqueda, filtros, GPS, mapa
- ReservasViewModel — crear, cancelar, listar
- FavoritosViewModel — toggle, listar
- ResenasViewModel — crear, listar

### GPS / Ubicación
- CLLocationManager con permisos
- Geocodificación inversa (ciudad)
- Banner si GPS denegado → link a Ajustes
- Selector de radio de búsqueda
- Chip de distancia en cada quincho

### CI/CD
- **Codemagic** compilando en Mac Mini M2
- Code signing automático (App Store Connect API)
- Push a TestFlight automático en cada push a main
- App en TestFlight: **QuinchApp** versión 1.0.0

---

## 🤖 Android — quinchos-android

### Arquitectura
- **Jetpack Compose** + **Material 3**
- **MVVM** con Hilt DI + StateFlow
- **Retrofit 2** + Kotlinx Serialization
- **Coil** para imágenes
- **Google Maps Compose**
- **FusedLocationProvider** para GPS
- **DataStore** para token JWT

### Pantallas
- Login/Registro
- Explorar (búsqueda, filtros, destacados)
- Detalle quincho
- Reservar
- Mapa (requiere Google Maps API Key)
- Mis Reservas
- Favoritos
- Cuenta

### Componentes
- QuinchoCard, StarRating, EstadoBadge, AmenidadChip
- LocationBanner, DistanciaChip, RadioSelector
- FilterChips, SearchBar

### ViewModels (4)
- AuthViewModel, QuinchosViewModel, ReservasViewModel, FavoritosViewModel

---

## ✅ LO QUE FUNCIONA HOY

- [x] Backend desplegado en VPS con SSL (https://quinchos.art3d-studio.com.ar)
- [x] PostgreSQL con 8 tablas + datos de prueba
- [x] ABM completo de quinchos (alta, baja soft/hard, modificación)
- [x] Búsqueda con filtros de texto, tipo, costo, capacidad, amenidades
- [x] Búsqueda por proximidad GPS (Haversine, sin PostGIS)
- [x] Endpoint de mapa con coordenadas y distancias
- [x] Sistema de reservas completo con estados
- [x] Propietario puede confirmar/rechazar/completar reservas
- [x] Agenda semanal con horarios y precios por día
- [x] Bloqueo/desbloqueo de fechas
- [x] Calendario de disponibilidad mensual
- [x] Dashboard del propietario con ingresos y estadísticas
- [x] Gestión de clientes (historial, gasto, frecuencia)
- [x] Reseñas con calificación + respuesta del propietario
- [x] Favoritos
- [x] Auth JWT con 3 roles
- [x] iOS app compilando y en TestFlight
- [x] Android app estructura completa

---

## 📋 PENDIENTES

### Backend
- [ ] Notificaciones push (reserva confirmada/cancelada/nueva)
- [ ] Subida de imágenes real (ahora son URLs, falta upload a S3/Cloudinary)
- [ ] Recuperar contraseña (envío de email)
- [ ] Login con Google / Apple
- [ ] Pago online (MercadoPago integración)
- [ ] Chat entre usuario y propietario
- [ ] Reportar quincho/reseña
- [ ] Historial de cambios de precio
- [ ] Cupones de descuento
- [ ] Sistema de verificación de propietarios

### iOS
- [ ] Actualizar app para consumir endpoints nuevos (agenda, dashboard, bloqueos)
- [ ] Pantalla de registro de propietario
- [ ] Panel de gestión de propietario (confirmar reservas, ver clientes)
- [ ] Calendario visual de disponibilidad
- [ ] Galería de fotos con zoom
- [ ] Pull-to-refresh en todas las pantallas
- [ ] Manejo de errores de red (offline, retry)
- [ ] Splash screen personalizado
- [ ] Ícono de app real (diseño profesional)
- [ ] Deep links (compartir quincho por link)
- [ ] Notificaciones push
- [ ] Escribir reseña post-reserva

### Android
- [ ] Apuntar API a URL de producción
- [ ] Completar todas las pantallas como iOS
- [ ] Agregar GPS y componentes de ubicación a las pantallas
- [ ] Configurar Google Maps API Key
- [ ] Compilar y subir a Google Play Console
- [ ] Testing en dispositivos reales
- [ ] Ícono de app

### Generales
- [ ] Diseño de logo profesional
- [ ] Screenshots para App Store / Play Store
- [ ] Política de privacidad y términos
- [ ] Landing page web (quinchos.art3d-studio.com.ar)
- [ ] Panel web admin/propietario
- [ ] Monitoreo y alertas (logs, uptime)
- [ ] Backups automáticos de la base de datos
- [ ] Tests unitarios y de integración

---

## 🔐 Credenciales

### Backend (producción)
- URL: https://quinchos.art3d-studio.com.ar
- VPS: Hostinger Debian (31.97.103.63)
- DNS: Cloudflare
- Docker: quinchos-db + quinchos-api en traefik-public

### Usuarios de prueba (password: 123456)
| Email | Rol |
|---|---|
| admin@quinchos.app | ADMIN |
| carlos@quinchos.app | PROPIETARIO |
| maria@quinchos.app | PROPIETARIO |
| laura@gmail.com | USUARIO |
| martin@gmail.com | USUARIO |
| sofia@gmail.com | USUARIO |
| ale@quinchos.app | USUARIO |
| jpv@quinchos.app | USUARIO |

### Apple
- Team ID: L2V2C22VFC
- Bundle ID: com.quinchos.app
- App Store Connect ID: 6806033448
- Codemagic: integración "IT rispy"

### Comandos VPS
```
cd /opt/quinchos-api
docker compose logs -f quinchos-api    # Ver logs
docker compose restart quinchos-api    # Reiniciar API
docker compose down && docker compose up -d  # Reiniciar todo
docker compose exec -T quinchos-api npx prisma db push  # Migrar
docker compose exec -T quinchos-api npx tsx prisma/seed.ts  # Seed
```
