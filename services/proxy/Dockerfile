# Node.js Proxy Service Dockerfile
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY server.js ./

# Expose port (Railway will inject PORT env var)
EXPOSE ${PORT:-3001}

# Start the proxy (server.js reads PORT from environment)
CMD ["node", "server.js"]

