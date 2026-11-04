# --- build ---
FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
# Set NPM_STRICT_SSL=false only behind a TLS-intercepting proxy.
ARG NPM_STRICT_SSL=true
RUN npm ci --strict-ssl=${NPM_STRICT_SSL}

COPY . .

ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
RUN printf 'VITE_OIDC_AUTHORITY=%s\nVITE_OIDC_CLIENT_ID=%s\nVITE_OIDC_REDIRECT_URI=%s\n' \
      "$VITE_OIDC_AUTHORITY" "$VITE_OIDC_CLIENT_ID" "$VITE_OIDC_REDIRECT_URI" > .env.production
RUN npm run build

# --- serve ---
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
