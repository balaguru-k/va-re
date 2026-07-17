FROM node:20-alpine

# Enforce secure node environment variables
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY..

EXPOSE 5000

# Set dynamic connection parameters pointing to the host system
ENV PORT=5000 \
    DB_HOST=host.docker.internal \
    DB_PORT=3306 \
    DB_USER=app_backend \
    DB_PASSWORD=production_secure_password \
    DB_NAME=application_db

# Loop-check host port connectivity, execute migrations, and start server
CMD sh -c "\
    echo 'Verifying Database host gateway connectivity...'; \
    for i in \$(seq 1 30); do \
        nc -z -w 1 ${DB_HOST} ${DB_PORT} && echo 'Host database interface is active.' && break; \
        echo 'Host database interface is unreachable. Retrying in 2 seconds...'; \
        sleep 2; \
    done; \
    echo 'Database online. Running migrations...'; \
    npx knex migrate:latest --env production && \
    echo 'Migrations completed. Launching application...'; \
    node src/index.js"
