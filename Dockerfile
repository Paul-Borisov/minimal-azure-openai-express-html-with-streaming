# Builds a compact image of 265.76 MB
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm i --omit=dev

COPY . .

# https://github.com/GoogleContainerTools/distroless?tab=readme-ov-file#what-images-are-available
FROM gcr.io/distroless/nodejs22-debian12:nonroot
COPY --from=build /app /app
COPY --from=build /bin/ /bin/
COPY --from=build /lib/ /lib/
COPY --from=build /usr/bin/vi /usr/bin/vi
COPY --from=build /usr/bin/clear /usr/bin/clear
COPY --from=build /usr/bin/less /usr/bin/less
RUN touch ~/.vimrc

WORKDIR /app

EXPOSE 3000

CMD ["server.js"]
