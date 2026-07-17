FROM node:20-alpine

# Enforce secure node environment variables
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# FIXED: Added spaces to copy instruction
COPY . .

EXPOSE 5000

# Set dynamic connection parameters pointing to the host system
ENV PORT=5000 \
    DB_HOST=host.docker.internal \
    DB_PORT=3306 \
    DB_USER=app_backend \
    DB_PASSWORD=production_secure_password \
    DB_NAME=va_rewamp

# Runs your defined package.json start script dynamically
CMD ["npm", "start"]
