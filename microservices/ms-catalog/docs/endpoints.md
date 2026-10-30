# Matriz HTTP actual de ms_catalog

Generada con `npm run openapi:export`. Administracion: JWT, sesion vigente y rol ADMIN via Identity.

| Método | Ruta                                       | Acceso      | Respuestas documentadas           |
| ------ | ------------------------------------------ | ----------- | --------------------------------- |
| GET    | `/api/v2/health/live`                      | Público     | 200                               |
| GET    | `/api/v2/atracciones/categorias/arbol`     | Público     | 200, 500, 503                     |
| GET    | `/api/v2/atracciones/categorias`           | Público     | 200, 400, 500, 503                |
| POST   | `/api/v2/atracciones/categorias`           | JWT / ADMIN | 201, 400, 401, 403, 409, 503      |
| PATCH  | `/api/v2/atracciones/categorias/{id}`      | JWT / ADMIN | 200, 400, 401, 403, 404, 409, 503 |
| DELETE | `/api/v2/atracciones/categorias/{id}`      | JWT / ADMIN | 204, 401, 403, 404, 409, 503      |
| GET    | `/api/v2/idiomas`                          | Público     | 200, 500                          |
| POST   | `/api/v2/idiomas`                          | JWT / ADMIN | 201, 400, 401, 403, 409, 503      |
| GET    | `/api/v2/idiomas/{id}`                     | JWT / ADMIN | 200, 401, 403, 404, 503           |
| PATCH  | `/api/v2/idiomas/{id}`                     | JWT / ADMIN | 200, 400, 401, 403, 404, 503      |
| DELETE | `/api/v2/idiomas/{id}`                     | JWT / ADMIN | 204, 401, 403, 404, 409, 503      |
| GET    | `/api/v2/inclusiones`                      | Público     | 200, 400, 500                     |
| POST   | `/api/v2/inclusiones`                      | JWT / ADMIN | 201, 400, 401, 403, 409, 503      |
| GET    | `/api/v2/inclusiones/{id}`                 | JWT / ADMIN | 200, 401, 403, 404, 503           |
| PATCH  | `/api/v2/inclusiones/{id}`                 | JWT / ADMIN | 200, 400, 401, 403, 404, 409, 503 |
| DELETE | `/api/v2/inclusiones/{id}`                 | JWT / ADMIN | 204, 401, 403, 404, 409, 503      |
| GET    | `/api/v2/operadores`                       | JWT / ADMIN | 200, 401, 403, 503                |
| POST   | `/api/v2/operadores`                       | JWT / ADMIN | 201, 400, 401, 403, 409, 503      |
| GET    | `/api/v2/operadores/{id}`                  | JWT / ADMIN | 200, 401, 403, 404, 503           |
| PATCH  | `/api/v2/operadores/{id}`                  | JWT / ADMIN | 200, 400, 401, 403, 404, 409, 503 |
| DELETE | `/api/v2/operadores/{id}`                  | JWT / ADMIN | 204, 401, 403, 404, 503           |
| GET    | `/api/v2/operadores/{id}/usuarios`         | JWT / ADMIN | 200, 401, 403, 404, 503           |
| POST   | `/api/v2/operadores/{id}/usuarios`         | JWT / ADMIN | 201, 400, 401, 403, 404, 409, 503 |
| PATCH  | `/api/v2/operadores/{id}/usuarios/{usuId}` | JWT / ADMIN | 200, 401, 403, 404, 503           |
| DELETE | `/api/v2/operadores/{id}/usuarios/{usuId}` | JWT / ADMIN | 204, 401, 403, 404, 503           |
| GET    | `/api/v2/atracciones`                      | Público     | 200, 400, 500, 503                |
| POST   | `/api/v2/atracciones`                      | JWT / ADMIN | 201, 400, 401, 403, 404, 409, 503 |
| POST   | `/api/v2/atracciones/search`               | Público     | 200, 400, 500, 503                |
| PATCH  | `/api/v2/atracciones/{id}/estado`          | JWT / ADMIN | 200, 400, 401, 403, 404, 503      |
| PUT    | `/api/v2/atracciones/{id}/categorias`      | JWT / ADMIN | 200, 401, 403, 404, 503           |
| PUT    | `/api/v2/atracciones/{id}/idiomas`         | JWT / ADMIN | 200, 401, 403, 404, 503           |
| PUT    | `/api/v2/atracciones/{id}/inclusiones`     | JWT / ADMIN | 200, 401, 403, 404, 503           |
| POST   | `/api/v2/atracciones/{id}/fotos`           | JWT / ADMIN | 201, 401, 403, 404, 503           |
| PATCH  | `/api/v2/atracciones/{id}/fotos/{fotoId}`  | JWT / ADMIN | 200, 401, 403, 404, 503           |
| DELETE | `/api/v2/atracciones/{id}/fotos/{fotoId}`  | JWT / ADMIN | 204, 401, 403, 404, 503           |
| GET    | `/api/v2/atracciones/{id}`                 | Público     | 200, 404, 500, 503                |
| PATCH  | `/api/v2/atracciones/{id}`                 | JWT / ADMIN | 200, 400, 401, 403, 404, 409, 503 |
| DELETE | `/api/v2/atracciones/{id}`                 | JWT / ADMIN | 204, 401, 403, 404, 503           |
| PUT    | `/api/v2/atracciones/{id}/booking`         | JWT / ADMIN | 200, 401, 403, 503                |
