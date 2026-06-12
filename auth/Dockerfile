# Compile common to JS
FROM node:alpine AS common-builder
WORKDIR /app
COPY common/package*.json ./common/
RUN cd common && npm install
COPY common/src ./common/src
COPY common/tsconfig.json ./common/
RUN cd common && npm run build

FROM node:alpine
# Copy compiled common/dist/
WORKDIR /app
COPY common/package.json ./common/
COPY --from=common-builder /app/common/dist ./common/dist
# Copy auth TS
COPY auth/package*.json ./auth/
RUN cd auth && npm install --omit=dev
COPY auth/src ./auth/src
COPY auth/tsconfig.json ./auth/
# Start auth (with tsx)
WORKDIR /app/auth
CMD ["npm", "start"]
