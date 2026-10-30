# Integraciones y decisiones pendientes

Actualizacion: la integracion con Identity y la administracion ADMIN ya estan implementadas. Ver [estado actual](infraestructura-booking.md). Este documento conserva los pendientes y decisiones de la entrega local anterior. El acceso por propietario OPERADOR sigue sin habilitarse.

Estado al cierre local: 2026-10-28. Este documento registra requisitos de entrada;
no define contratos nuevos ni autoriza habilitar administración o desplegar.

| Pendiente                | Fuente o responsable requerido               | Información necesaria                                                                                                    | Comportamiento actual                                                                               |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| JWT de Identity          | Contrato aprobado de `ms_identity`           | Issuer, audience, algoritmos, claves/JWKS y rotación, expiración, revocación y claims verificables                       | Ningún token concede acceso; administración devuelve 401                                            |
| Sujeto y autorización    | Identity y responsables del contrato interno | Correspondencia sujeto/usu_id bigint, matriz de roles/permisos por operación y alcance de operadores                     | No hay usuario autenticado ni RBAC operativo                                                        |
| Propiedad del operador   | Política aprobada de Catalog/Identity        | Uso de asociación y operador activos, recursos autorizados, reasignación de atracciones y permisos para asociar usuarios | El cierre administrativo impide escrituras; no se declara autorización por propietario implementada |
| DTOs administrativos     | Responsable del contrato interno Catalog     | Ratificar rutas, identificadores, nulabilidad, campos y permisos; reconciliar `role` con `opeu_cargo`                    | Hay código y esquemas previstos, pero las operaciones están bloqueadas                              |
| IDs externos             | APIs aprobadas de Identity/Location          | Consulta de usuarios, ciudades/provincias, estados válidos, errores y política ante indisponibilidad                     | IDs lógicos; no hay consultas a bases externas ni validación remota                                 |
| Publicación              | Reglas aprobadas de Catalog                  | Transiciones admitidas, requisitos de publicación y visibilidad de recursos vinculados                                   | Los tres estados del SQL están admitidos; no se inventó un grafo de transiciones                    |
| Proyección Review        | Contrato `RESENA_PUBLICADA` de `ms_review`   | Versión, identificación de atracción, contenido y escala de proyección, entrega, autenticidad, duplicados y orden        | Campos de solo lectura en administración/ORM; no existe consumidor                                  |
| Composición Booking      | `integration-booking` y contrato externo v3  | Composición con Location/Pricing/Inventory/Review, errores y autenticación entre servicios                               | Catalog expone únicamente sus datos propios bajo `/api/v2`                                          |
| Contrato Booking externo | Propietario de `atracciones-openapi-v3.yaml` | Resolver la duplicación ya registrada en `TimeSlotItem`                                                                  | No se modificó el archivo externo                                                                   |

## Condiciones antes de abrir administración

Primero deben aprobarse el perfil de tokens, el vínculo con Identity y la matriz
de permisos. Después se implementará la verificación criptográfica y la política
de propiedad, manteniendo denegación por defecto. No basta con sustituir el guard
por uno que decodifique claims o acepte un rol enviado por el cliente.

La validación ADMIN/VENDEDOR/GUIA que existe en los DTOs corresponde al campo de
asociación `role`; SQL define `opeu_cargo` como texto. Esa lista no constituye un
contrato JWT ni una matriz RBAC aprobada.

También deben cerrarse estas revisiones técnicas del código administrativo:

- Probar con PostgreSQL la resolución de identificadores de operador bigint:
  `OperatorsService.findById` todavía convierte el argumento a Number para
  buscar también por código integer. Revisar pérdida de precisión y desbordamiento
  antes de permitir acceso a esa operación.
- Revisar los DTOs administrativos contra los límites y nulabilidad exactos del SQL,
  incluidos IDs y campos opcionales. Los ejemplos Swagger no sustituyen esa ratificación.
- Verificar concurrencia al editar jerarquías y al comprobar dependencias antes de
  borrar; las pruebas actuales de ciclos y guardas no prueban carreras concurrentes.
- Ejecutar creación, actualización, conflictos y permisos con identidades reales
  autorizadas y denegadas. Las pruebas con fixtures o llamadas internas a servicios
  no equivalen a autenticación HTTP real.

No se atribuyen estos pendientes a contratos ya implementados ni se declaran sus
pruebas aprobadas. Las rutas permanecen cerradas durante su resolución.

## Operación futura

El stack actual es de desarrollo local: puertos en loopback, usuario PostgreSQL
de bootstrap y liveness HTTP. Privilegios mínimos de aplicación, TLS, gestión de
secretos, readiness, backup/restore, observabilidad y configuración por ambiente
requieren diseño y validación antes de un entorno operativo externo.

La instalación Docker de G informó seis avisos bajos en dependencias de desarrollo
y cero en la instalación de producción. Revisar la cadena de dependencias al
actualizar; no aplicar cambios forzados sin regresión.

Azure es una evaluación posterior. No se prepararon recursos, pipelines CD,
registros remotos ni despliegues; Render no forma parte de esta entrega.
