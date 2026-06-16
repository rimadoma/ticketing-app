FROM node:alpine
WORKDIR /app

COPY common/ ./common/
RUN cd common && npm install && npm run build
COPY auth/ ./auth/
RUN cd auth && npm install --omit=dev

CMD ["npm", "--prefix", "auth", "run", "dev"]
