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

# Use official Nginx template mechanism
COPY nginx.conf /etc/nginx/templates/default.conf.template

# CRITICAL: Tell envsubst to ONLY replace $PORT, preventing $uri from being erased
ENV NGINX_ENVSUBST_VARS='$PORT'
ENV PORT=80
EXPOSE 80 4050 8080

CMD ["nginx", "-g", "daemon off;"]
