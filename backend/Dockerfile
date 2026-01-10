FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY *.js ./
COPY index.json ./

EXPOSE 3000
CMD ["node", "main.js"]
