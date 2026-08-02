# Stage 1: Build dependencies
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copy node_modules from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
# Copy source files
COPY . .

# Ensure secure process owner (use default node user)
USER node

# Expose server port
EXPOSE 5000

ENV NODE_ENV=production

CMD ["sh", "-c", "npx migrate-mongo up && node src/server.js"]
