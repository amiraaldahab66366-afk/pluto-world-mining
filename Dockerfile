FROM node:18-alpine as builder
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
# Install all deps (including dev) for build
RUN npm install
COPY . .
# Build the frontend into public/
RUN npm run build
# Initialize the database so data.db is present in the builder image
RUN node init-db.js

FROM node:18-alpine as runner
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/server.js ./server.js
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/init-db.js ./init-db.js

EXPOSE 8080
CMD ["node", "server.js"]
