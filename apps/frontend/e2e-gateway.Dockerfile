FROM nginx:1.27-alpine

COPY apps/frontend/e2e-gateway.conf /etc/nginx/conf.d/default.conf
