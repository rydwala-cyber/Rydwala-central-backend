FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
