# Builder stage
FROM node:14-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./

COPY ./src ./src

RUN npm ci --quiet && npm run build

# Production stage
FROM node:14-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY LICENSE ./
COPY package*.json ./
RUN npm ci --quiet --only=production

COPY --from=builder /usr/src/app/dist ./dist

CMD ["npm", "start"]