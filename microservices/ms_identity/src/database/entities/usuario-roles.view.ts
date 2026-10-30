import { ViewEntity, ViewColumn } from 'typeorm';
@ViewEntity({
  name: 'v_usuario_roles',
  synchronize: false,
  expression: `SELECT u.usu_id, u.usu_correo, u.usu_nombre, u.usu_apellido, r.rol_id, r.rol_nombre FROM usuario u JOIN usuario_rol ur ON ur.usu_id=u.usu_id JOIN rol r ON r.rol_id=ur.rol_id WHERE u.usu_activo AND r.rol_activo`,
})
export class UsuarioRolesView {
  @ViewColumn()
  usu_id!: string;
  @ViewColumn()
  usu_correo!: string;
  @ViewColumn()
  usu_nombre!: string;
  @ViewColumn()
  usu_apellido!: string;
  @ViewColumn()
  rol_id!: number;
  @ViewColumn()
  rol_nombre!: string;
}
