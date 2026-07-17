# =====================================================================
# Stage 1: Build & Compilation Environment
# =====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Leverage layer caching for faster builds
COPY package*.json./
RUN npm ci

# FIXED: Added spaces to copy instruction
COPY..
RUN npm run build

# =====================================================================
# Stage 2: Minimalist Production Web Server
# =====================================================================
FROM nginx:1.25-alpine

# Purge default configurations
RUN rm /etc/nginx/conf.d/default.conf

# Inject Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from Stage 1 (maps to Vite 'dist' or CRA 'build')
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
