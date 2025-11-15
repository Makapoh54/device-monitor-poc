FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY nest-cli.json tsconfig*.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci
RUN npm run build -- device-mock

FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY apps/device-mock/.env.development ./apps/device-mock/.env
COPY libs ./libs

EXPOSE 3000 50051

CMD ["node", "dist/apps/device-mock/main"]
