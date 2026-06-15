FROM node:alpine
WORKDIR /app
COPY common/ ./common/
COPY auth/ ./auth/
RUN cd common && npm install && npm run build
RUN cd auth && npm install --omit=dev
WORKDIR /app/auth
CMD ["npm", "start"]
