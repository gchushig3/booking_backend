import { OperadorEntity } from './operador.entity.js';
import { OperadorUsuarioEntity } from './operador-usuario.entity.js';
import { CategoriaEntity } from './categoria.entity.js';
import { IdiomaEntity } from './idioma.entity.js';
import { InclusionEntity } from './inclusion.entity.js';
import { AtraccionEntity } from './atraccion.entity.js';
import { AtraccionCategoriaEntity } from './atraccion-categoria.entity.js';
import { AtraccionIdiomaEntity } from './atraccion-idioma.entity.js';
import { AtraccionInclusionEntity } from './atraccion-inclusion.entity.js';
import { AtraccionFotoEntity } from './atraccion-foto.entity.js';
import { AtraccionCompletaView } from './atraccion-completa.view.js';

export { OperadorEntity };
export { OperadorUsuarioEntity };
export { CategoriaEntity };
export { IdiomaEntity };
export { InclusionEntity };
export { AtraccionEntity };
export { AtraccionCategoriaEntity };
export { AtraccionIdiomaEntity };
export { AtraccionInclusionEntity };
export { AtraccionFotoEntity };
export { AtraccionCompletaView };

import { BookingProfileEntity } from '../../booking/booking-profile.entity.js';
export const CATALOG_ENTITIES = [
  BookingProfileEntity,
  OperadorEntity,
  OperadorUsuarioEntity,
  CategoriaEntity,
  IdiomaEntity,
  InclusionEntity,
  AtraccionEntity,
  AtraccionCategoriaEntity,
  AtraccionIdiomaEntity,
  AtraccionInclusionEntity,
  AtraccionFotoEntity,
  AtraccionCompletaView,
];
