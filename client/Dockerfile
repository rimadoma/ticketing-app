FROM node:alpine
WORKDIR /app/client

COPY package.json ./
COPY package-lock.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]
