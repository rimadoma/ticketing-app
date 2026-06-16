FROM node:alpine
WORKDIR /app

COPY client/package.json client/
COPY client/package-lock.json client/
RUN cd client && npm ci
COPY client/ ./client/

WORKDIR /app/client
CMD ["npm", "run", "dev"]
