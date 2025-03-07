# Builds a compact image of 265.76 MB
FROM node:22-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm i --omit=dev

COPY . .

# https://github.com/GoogleContainerTools/distroless?tab=readme-ov-file#what-images-are-available
FROM gcr.io/distroless/nodejs22-debian12:nonroot
COPY --from=build /app /app
WORKDIR /app

EXPOSE 3000

CMD ["server.js"]
