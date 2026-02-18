FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy dependency files and install
COPY package*.json ./
RUN npm install

# Copy your source files (all from ./src to /app/src in container)
COPY ./src ./src

# Change to the src directory where your server.js is
WORKDIR /app/src

# Expose port if needed
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]

