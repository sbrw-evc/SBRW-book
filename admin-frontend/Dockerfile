FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY . .
ARG VITE_API_URL=/api
ARG VITE_MAIN_SITE_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MAIN_SITE_URL=${VITE_MAIN_SITE_URL}

RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.js ./

EXPOSE 3001
CMD ["npm", "run", "preview"]
