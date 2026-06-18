FROM node:alpine
WORKDIR /app

COPY auth/package.json auth/package-lock.json ./auth/
RUN cd auth && npm install --omit=dev

COPY auth/ ./auth/

CMD ["npm", "--prefix", "auth", "run", "dev"]
