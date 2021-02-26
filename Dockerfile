# Builder stage
FROM node:14-alpine AS builder
WORKDIR /usr/src/app

COPY tsconfig*.json ./
COPY ./prisma ./
COPY package*.json ./

COPY ./src ./src

RUN npm ci --quiet && npm run build

# Production stage
FROM node:14-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production \
    NTBA_FIX_319=true

COPY LICENSE ./
COPY package*.json ./
RUN npm ci --quiet --only=production

COPY --from=builder /usr/src/app/node_modules/@prisma/client/ ./node_modules/@prisma/client/
COPY --from=builder /usr/src/app/node_modules/.prisma/client/ ./node_modules/.prisma/client/

COPY --from=builder /usr/src/app/dist ./dist

CMD ["npm", "start"]