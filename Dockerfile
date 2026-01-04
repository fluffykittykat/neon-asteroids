# Stage 1: Build the Bundle
FROM node:18-slim AS builder
WORKDIR /app
COPY package.json .
RUN yarn install
COPY . .
RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy the bundled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Port configured in nginx.conf (8080)
EXPOSE 8080
