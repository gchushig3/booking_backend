import { RolEntity } from './rol.entity.js';
export { RolEntity };
import { UsuarioEntity } from './usuario.entity.js';
export { UsuarioEntity };
import { UsuarioRolEntity } from './usuario-rol.entity.js';
export { UsuarioRolEntity };
import { SesionEntity } from './sesion.entity.js';
export { SesionEntity };
import { TokenVerificacionEntity } from './token-verificacion.entity.js';
export { TokenVerificacionEntity };
import { UsuarioRolesView } from './usuario-roles.view.js';
export { UsuarioRolesView };
export const IDENTITY_ENTITIES = [
  RolEntity,
  UsuarioEntity,
  UsuarioRolEntity,
  SesionEntity,
  TokenVerificacionEntity,
  UsuarioRolesView,
];
