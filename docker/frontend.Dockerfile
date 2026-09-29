FROM nginxinc/nginx-unprivileged:1.28-alpine-slim

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY client/ /usr/share/nginx/html/

EXPOSE 8080
