import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/servicios.controller';

const router = Router();
const propietario = [auth, requireRole('PROPIETARIO', 'ADMIN')];

// ─── Catálogos públicos ───
router.get('/catalogo/amenidades', asyncHandler(ctrl.catalogoAmenidades));
router.get('/catalogo/sugerencias', asyncHandler(ctrl.sugerenciasServicios));

// ─── Amenidades del quincho ───
router.put('/:quinchoId/amenidades', ...propietario, asyncHandler(ctrl.actualizarAmenidades));
router.post('/:quinchoId/amenidades', ...propietario, asyncHandler(ctrl.agregarAmenidad));
router.delete('/:quinchoId/amenidades/:amenidad', ...propietario, asyncHandler(ctrl.quitarAmenidad));

// ─── Servicios extra ───
router.get('/:quinchoId/servicios', asyncHandler(ctrl.listarServicios));
router.get('/:quinchoId/servicios/admin', ...propietario, asyncHandler(ctrl.listarServiciosPropietario));
router.post('/:quinchoId/servicios', ...propietario, asyncHandler(ctrl.crearServicio));
router.patch('/servicios/:servicioId', ...propietario, asyncHandler(ctrl.actualizarServicio));
router.delete('/servicios/:servicioId', ...propietario, asyncHandler(ctrl.eliminarServicio));

export default router;
