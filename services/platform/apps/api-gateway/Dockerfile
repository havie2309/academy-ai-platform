FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps/api-gateway ./apps/api-gateway
COPY src/common ./src/common
RUN npm install
RUN npx nest build api-gateway
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/apps/api-gateway/main"]
