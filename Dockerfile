FROM node:10.14-alpine as build

WORKDIR /tmp/clubnorse-api

COPY package-lock.json .
COPY package.json .

RUN set -ex; \
  apk add \
    --no-cache \
    --virtual build \
    g++ \
    make \
    python \
  ; \
  npm i


FROM node:10.14-alpine

ENV DB_HOST=
ENV DB_PORT=
ENV DB_NAME=
ENV DB_USER=
ENV DB_PASS=
ENV DB_CERT=
ENV DB_KEY=
ENV POSTMARK_API_TOKEN=
ENV JWT_SECRET=

WORKDIR /var/clubnorse-api

COPY --from=build /tmp/clubnorse-api/node_modules ./node_modules
COPY --from=build /tmp/clubnorse-api/package-lock.json .
COPY --from=build /tmp/clubnorse-api/package.json .
COPY models/ ./models
COPY .config.js .
COPY index.js .

CMD ["npm", "start"]

EXPOSE 3001
