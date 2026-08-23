# Stage 1: Build Angular application
FROM node:22-alpine AS build
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy project source and build
COPY . .
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine
# In Angular 17+, the build output is located at /app/dist/portfolio-intelligence/browser
COPY --from=build /app/dist/portfolio-intelligence/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Support Railway dynamic PORT or default to 80
ENV PORT=80
EXPOSE 80

CMD ["sh", "-c", "sed -i 's/listen 80;/listen '\"${PORT:-80}\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
