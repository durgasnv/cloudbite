FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server/ ./server/

USER node
EXPOSE 5000

CMD ["node", "server/server.js"]
