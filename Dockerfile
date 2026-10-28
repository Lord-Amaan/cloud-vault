# ========================================================
# Dockerfile: Cloud-Native Document & Media Vault
# Multi-stage lightweight build on Node.js 20 Alpine Linux
# ========================================================

FROM node:20-alpine AS base

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy application source code
COPY . .

# Switch to unprivileged 'node' user for defense-in-depth container security
USER node

# Expose server port
EXPOSE 5000

# Container healthcheck targeting the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Launch using dumb-init to handle SIGINT/SIGTERM gracefully
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
