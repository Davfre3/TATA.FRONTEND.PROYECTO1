# ==============================================================================
# Multi-stage Dockerfile para TATA.FRONTEND.PROYECTO1 (Vue 3 + Quasar v2 + Vite)
# ==============================================================================

# STAGE 1: Compilación de la aplicación estática
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependencias
COPY package*.json quasar.config.* ./
RUN npm install --ignore-scripts

# Copiar el código fuente y compilar para producción
COPY . .
RUN npx quasar prepare && npm run build

# ------------------------------------------------------------------------------
# STAGE 2: Servidor Nginx liviano para servir estáticos y reverse proxy
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS final

# Copiar artefactos compilados al directorio web de Nginx
COPY --from=build /app/dist/spa /usr/share/nginx/html

# Copiar configuración personalizada de Nginx con reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto estándar HTTP
EXPOSE 80

# Iniciar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
