FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/server.ts /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/lib ./lib
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
