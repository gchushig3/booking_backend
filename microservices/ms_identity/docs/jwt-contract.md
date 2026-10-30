# Contrato JWT y claves públicas

Firma RS256 con RSA de al menos 3072 bits. Claves privadas locales generadas
explícitamente, no compartidas con consumidores. Librería jose verifica algoritmo,
issuer, audience, typ, expiración y claims obligatorios; no acepta alg=none.

| Campo     | Access                        | Refresh                                             |
| --------- | ----------------------------- | --------------------------------------------------- |
| alg       | RS256                         | RS256                                               |
| kid       | UUID de clave activa          | UUID de clave activa                                |
| typ       | identity-access+jwt           | identity-refresh+jwt                                |
| iss       | urn:descubreec:identity       | urn:descubreec:identity                             |
| aud       | urn:descubreec:internal-api   | urn:descubreec:identity:refresh                     |
| sub       | ID usuario BIGINT como string | Mismo ID string                                     |
| sid       | UUID v4 de sesión             | Mismo UUID                                          |
| jti       | UUID v4 nuevo por emisión     | UUID v4 nuevo por emisión                           |
| iat / exp | NumericDate; 900s por defecto | NumericDate; vencimiento absoluto de sesión, 7 días |
| token_use | access                        | refresh                                             |
| roles     | Roles actualmente activos     | Ausente                                             |

El access nunca supera el vencimiento de la sesión. Refresh no prolonga sus siete
días. El único valor persistido en ses_token_hash es SHA-256 del refresh completo,
hex de 64 caracteres. Los access no se almacenan. Sesiones y usuario/roles actuales
se consultan en cada acceso protegido de Identity; no basta confiar en roles viejos
del JWT. IDs nunca pasan por Number. Expiración/revocación y estado de usuario se
comprueban tanto al acceder como al renovar.

Refresh bloquea usuario y sesión transaccionalmente. Cambia hash y tokens atómicamente.
Reutilizar un refresh firmado y todavía no expirado de la misma sid revoca toda esa
sesión; se confirma la revocación antes de responder 401. Un token sin firma válida
no puede revocar sesiones. Dos renovaciones simultáneas del mismo token producen
un 200 y un 401; este último revoca también el par recién emitido. El cliente debe
serializar refresh y cerrar sesión/reautenticar tras 401. Se conserva solo el hash
vigente, sin inventar tablas para un historial.

## Preparación y rotación local

```sh
npm run env:local
npm run keys:local
npm run env:test
npm run keys:test
```

`.keys/identity.local.json` y `.keys/identity.test.json` contienen clave activa privada
y claves públicas; Git y Docker los excluyen. El comando no sobrescribe una clave
existente, no imprime material privado ni lo genera en cada arranque. Utiliza
creación exclusiva de lock y reemplazo mediante archivo temporal. Permisos 0600
en sistemas que los aplican; en Windows deben mantenerse las ACL del usuario local.
Compose monta `.keys` en `/run/identity-keys` de solo lectura; app ejecuta como node.
En host, JWT_KEYRING_PATH puede fijar otro archivo; en Compose el path es explícito.
Issuer aprobado por defecto; modificarlo requiere coordinar todos los verificadores.

```sh
npm run keys:rotate
docker compose restart app
```

Rotación genera nuevo kid/par, elimina la privada anterior del keyring vigente y
retiene todas las públicas. El reinicio carga el nuevo conjunto; los tokens
anteriores continúan verificándose. No eliminar públicas durante al menos siete
días desde su última emisión, más el margen operativo acordado. Este comando no
las elimina automáticamente. Para test: `npm run keys:test -- --rotate`.
No es un gestor de claves de producción ni una promesa de borrado seguro de backups.

## Consumo por otros microservicios

JWKS local público: `http://localhost:3011/api/v2/.well-known/jwks.json`.
Devuelve únicamente kty, n, e, alg, use y kid, con caché 60s. Los consumidores
deben configurar esta URL de forma confiable; nunca seguir jku/x5u enviados en un
token. Verificar RS256, kid, typ, iss, aud, exp, sub string, sid, token_use=access
y permisos requeridos. Refresh solamente se entrega a Identity para renovar.
Ante un kid desconocido, refrescar JWKS de forma limitada y denegar si no existe.

La verificación offline permite comprobar firma y expiración; no garantiza conocer
revocaciones, cambios de roles ni usuarios inactivos al instante. Para comprobación
viva puede reenviarse el Bearer a GET /api/v2/auth/me; es una operación implementada,
no una integración automática. Cada consumidor aún debe acordar su política de
vigencia. No se modifica Catalog ni sus guards en esta fase.
Distribución/rotación con un gestor de claves y TLS de producción quedan pendientes
de aprobación futura; aquí todo se ejecuta localmente, sin Azure ni despliegue.
