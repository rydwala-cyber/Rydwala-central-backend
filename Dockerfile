FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

RUN apk add --no-cache unzip \
    && mkdir -p /tmp/rydwala \
    && unzip -q Rydwala-backend-postgres-patched.zip -d /tmp/rydwala \
    && ENTRY=$(find /tmp/rydwala -type f -name server.ts | head -n 1) \
    && ROOT=$(dirname "$ENTRY") \
    && cp -R "$ROOT/server" /app/server \
    && cp "$ROOT/server.ts" /app/server.ts \
    && rm -rf /tmp/rydwala

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
