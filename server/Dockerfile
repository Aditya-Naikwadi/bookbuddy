# Stage 1: Build dependencies
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Install build dependencies for native C++ binaries (argon2, bcrypt)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps

# Stage 2: Production image (Slim & Non-Root)
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Create non-root app user and group if node user needs distinct permissions
RUN chown -R node:node /usr/src/app

# Copy production node_modules from build stage
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node . .

# Switch to non-root user
USER node

# Expose port
EXPOSE 5000

# Environment Defaults
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start Express backend
CMD ["node", "src/server.js"]
