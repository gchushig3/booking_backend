# Contexto de build: raiz del repositorio
# docker build -f microservices/ms_support/Dockerfile -t ms_support .
FROM node:22-bookworm-slim AS infrastructure
WORKDIR /shared-infrastructure
COPY microservices/shared-infrastructure/package*.json microservices/shared-infrastructure/tsconfig.json ./
COPY microservices/shared-infrastructure/src ./src
COPY microservices/shared-infrastructure/sql ./sql
RUN npm ci --ignore-scripts && npm run build

FROM infrastructure AS build
WORKDIR /app
COPY microservices/ms_support/package*.json microservices/ms_support/.npmrc ./
RUN npm ci
COPY microservices/ms_support/tsconfig*.json microservices/ms_support/nest-cli.json ./
COPY microservices/ms_support/src ./src
RUN npm run build

FROM infrastructure AS production-dependencies
WORKDIR /app
COPY microservices/ms_support/package*.json microservices/ms_support/.npmrc ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3012
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node microservices/ms_support/package.json ./
USER node
EXPOSE 3012
CMD ["npm", "run", "start:prod"]