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
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/.generated/private ./.generated/private
COPY --from=build --chown=node:node /app/.generated/manifest.json ./.generated/manifest.json
COPY --chown=node:node scripts/start.mjs ./scripts/start.mjs
COPY --chown=node:node src/lib/auth.mjs ./src/lib/auth.mjs
USER node
EXPOSE 4321
CMD ["node", "scripts/start.mjs"]
