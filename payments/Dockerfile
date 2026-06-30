FROM node:alpine
WORKDIR /app

COPY payments/package.json payments/package-lock.json ./payments/
RUN cd payments && npm install --omit=dev

COPY payments/ ./payments/

CMD ["npm", "--prefix", "payments", "run", "dev"]
