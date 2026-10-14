FROM node:22-bookworm-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev"]

FROM development AS build
RUN npm run check && npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4321
CMD ["npx", "serve", "dist"]
