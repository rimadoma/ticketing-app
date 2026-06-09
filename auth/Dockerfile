FROM node:alpine
WORKDIR /app

COPY common/package*.json ./common/
RUN cd common && npm install
COPY common/src ./common/src
COPY common/tsconfig.json ./common/
RUN cd common && npm run build

COPY auth/package*.json ./auth/
RUN cd auth && npm install
COPY auth/src ./auth/src
COPY auth/tsconfig.json ./auth/

WORKDIR /app/auth
CMD ["npm", "start"]
