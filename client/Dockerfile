FROM node:alpine
WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY client/ ./client/

CMD ["npm", "--prefix", "client", "run", "dev"]
