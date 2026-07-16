# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# Vite reads VITE_* from the envDir (project root = one level up). In this build
# context that's `/`, so we materialise the build-time vars there.
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ARG VITE_PUBLIC_BASE_URL=http://localhost:5173
RUN printf 'VITE_API_URL=%s\nVITE_SOCKET_URL=%s\nVITE_PUBLIC_BASE_URL=%s\n' \
    "$VITE_API_URL" "$VITE_SOCKET_URL" "$VITE_PUBLIC_BASE_URL" > /.env

RUN npm run build

# --- serve stage ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
