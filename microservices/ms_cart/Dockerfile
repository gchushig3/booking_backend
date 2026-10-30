# Contexto de build: raiz del repositorio
FROM node:24-bookworm-slim AS infrastructure
WORKDIR /shared-infrastructure
COPY microservices/shared-infrastructure/package*.json microservices/shared-infrastructure/tsconfig.json ./
COPY microservices/shared-infrastructure/src ./src
COPY microservices/shared-infrastructure/sql ./sql
RUN npm ci --ignore-scripts && npm run build

FROM infrastructure AS build
WORKDIR /app
COPY microservices/ms_cart/package*.json microservices/ms_cart/.npmrc ./
RUN npm ci
COPY microservices/ms_cart/tsconfig*.json ./
COPY microservices/ms_cart/nest-cli.json ./
COPY microservices/ms_cart/src ./src
RUN npm run build

FROM infrastructure AS production-dependencies
WORKDIR /app
COPY microservices/ms_cart/package*.json microservices/ms_cart/.npmrc ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node microservices/ms_cart/package.json ./
COPY --chown=node:node contracts/inventory.proto ./contracts/inventory.proto
ENV INVENTORY_PROTO_PATH=/app/contracts/inventory.proto
USER node
CMD ["node", "dist/main.js"]
