# =====================================================================
# Stage 1: Build & Compilation Environment
# =====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Leverage layer caching for faster builds
COPY package*.json ./
RUN npm ci

# Copy source code and build production assets
COPY..
RUN npm run build

# =====================================================================
# Stage 2: Minimalist Production Web Server
# =====================================================================
FROM nginx:1.25-alpine

# Purge default configurations
RUN rm /etc/nginx/conf.d/default.conf

# Inject custom routing patterns
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
