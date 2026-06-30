FROM node:alpine
WORKDIR /app

COPY expiration/package.json expiration/package-lock.json ./expiration/
RUN cd expiration && npm install --omit=dev

COPY expiration/ ./expiration/

CMD ["npm", "--prefix", "expiration", "run", "dev"]
