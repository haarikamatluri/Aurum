# Stage 1: Build the Angular application
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Run with lightweight Node.js Express server
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies (Express)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled Angular distribution bundle & server
COPY --from=build /app/dist ./dist
COPY server.js ./

# Railway sets PORT dynamically (defaults to 8080 if not set)
EXPOSE 8080 4050 80

CMD ["node", "server.js"]
