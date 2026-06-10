FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy dependency files and install.
# maxsockets=1 + retries make npm resilient under QEMU arm64 emulation,
# which otherwise drops parallel TLS connections to the npm registry.
COPY package*.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set maxsockets 1
RUN for i in 1 2 3 4 5; do \
      echo "Attempt $i: npm install" && \
      npm install && break || \
      echo "npm install failed. Retrying in 10s..." && \
      sleep 10; \
    done

# Copy your source files (all from ./src to /app/src in container)
COPY ./src ./src

# Change to the src directory where your server.js is
WORKDIR /app/src

# Expose port if needed
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]

