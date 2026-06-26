FROM node:alpine
WORKDIR /app

COPY orders/package.json orders/package-lock.json ./orders/
RUN cd orders && npm install --omit=dev

COPY orders/ ./orders/

CMD ["npm", "--prefix", "orders", "run", "dev"]
