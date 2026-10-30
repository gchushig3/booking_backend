# Contrato interno de autorización — Fase E

Base /api/v2. Todas estas rutas exigen access JWT, sesión y usuario activos.
El guard obtiene roles activos de PostgreSQL en cada solicitud, no confía en
roles antiguos del token. ADMIN es el único rol con administración global;
OPERADOR y CLIENTE solo gestionan su perfil. No se presupone propiedad Catalog.

| Método/ruta                     | Permiso                      | Entrada                        | Respuesta                                            |
| ------------------------------- | ---------------------------- | ------------------------------ | ---------------------------------------------------- |
| GET /users/me                   | Cualquier rol activo         | —                              | 200 user                                             |
| PATCH /users/me                 | Propio, cualquier rol activo | Perfil parcial                 | 200 user                                             |
| GET /users                      | ADMIN                        | page=1, limit=20 (máximo 100)  | 200 items,total,page,limit                           |
| GET /users/:id                  | ADMIN                        | BIGINT decimal positivo string | 200 user                                             |
| PATCH /users/:id/status         | ADMIN                        | {active:boolean}               | 200 user; revoca sesiones al desactivar              |
| GET /roles                      | ADMIN                        | —                              | 200 array de roles, incluidos inactivos              |
| GET /users/:id/roles            | ADMIN                        | ID usuario                     | 200 array de asignaciones, incluidos roles inactivos |
| POST /users/:id/roles           | ADMIN                        | {role_id:smallint positivo}    | 201 asignación                                       |
| DELETE /users/:id/roles/:roleId | ADMIN                        | IDs usuario/rol                | 204                                                  |

Perfil admite únicamente first_name/last_name (trim, no vacíos, máximo 120),
document (dom_documento), phone (dom_telefono), birth_date (YYYY-MM-DD válida),
avatar_url (URL HTTP/HTTPS, máximo 255). Los cuatro opcionales SQL aceptan null
para limpiar; los nombres no aceptan null. Rechazar PATCH vacío/campos extra.
Email, contraseña, roles, active y verified no son campos editables del perfil.
No se incorporan cambios de correo sin un flujo de verificación acordado.

User usa exactamente la representación segura de auth/me: BIGINT string, ningún
hash ni token. Rol: id, name, description, active. Asignación añade assigned_at y
assigned_by (ID string o null); nunca relaciona tablas de otro servicio.

Errores Problem Details: 400 validación; 401 sin credenciales o sesión revocada;
403 rol insuficiente o edición de roles propios; 404 usuario/rol/asignación ausente;
409 duplicado de documento/asignación, rol inactivo, auto-desactivación o pérdida
del último ADMIN activo; 500/503 seguros. No se crea una ruta pública de promoción.
No se permite editar asignaciones propias mediante la API administrativa.

Cambios de rol revocan todas las sesiones del usuario afectado (relogin para
recibir nuevos claims); status=false también invalida tokens de verificación
pendientes. ADMIN no puede auto-desactivarse. Una transacción serializa cambios
administrativos y preserva al menos un usuario ADMIN activo; cada escritura vuelve
a validar al actor, su sesión y rol ADMIN dentro de la transacción para evitar
autorizar con un estado obsoleto entre guard y persistencia.

Bootstrap: CLI explícita local, nunca en arranque HTTP ni en registro. Crea el primer
ADMIN, o no modifica nada al repetirse para el mismo ADMIN activo; rechaza promover
una cuenta existente no ADMIN, reactivar cuentas o crear un segundo ADMIN. Este
último se asigna con la API autenticada. Guarda bcrypt, no imprime credenciales y
rechaza APP_ENV=production, targets remotos y habilitación ausente. Detalles en README.
Swagger disponible desde F en /api/docs; su documento refleja estas políticas,
manteniendo públicas las rutas de autenticación autorizadas y protegidas las administrativas.
