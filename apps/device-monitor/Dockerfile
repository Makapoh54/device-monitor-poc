FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY nest-cli.json tsconfig*.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm ci
RUN npm run build -- device-monitor
RUN mkdir -p dist/apps/public && cp -r apps/device-monitor/public/* dist/apps/public/

FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY apps/device-monitor/.env.development ./apps/device-monitor/.env
COPY libs ./libs

EXPOSE 3000

CMD ["node", "dist/apps/device-monitor/main"]
