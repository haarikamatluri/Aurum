# Stage 1: Build Angular application
FROM node:22-alpine AS build
WORKDIR /app

# Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source and build production bundle
COPY . .
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Copy build artifacts to Nginx html root
COPY --from=build /app/dist/portfolio-intelligence/browser /usr/share/nginx/html

# Use official Nginx template mechanism to automatically inject $PORT at runtime
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Default PORT fallback if Railway doesn't specify one
ENV PORT=80
EXPOSE 80 4050 8080

# Nginx official image entrypoint automatically runs envsubst on /etc/nginx/templates/*.template
CMD ["nginx", "-g", "daemon off;"]
