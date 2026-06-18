FROM node:alpine
WORKDIR /app

COPY tickets/package.json tickets/package-lock.json ./tickets/
RUN cd tickets && npm install --omit=dev

COPY tickets/ ./tickets/

CMD ["npm", "--prefix", "tickets", "run", "dev"]
