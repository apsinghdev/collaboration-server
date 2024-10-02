FROM alpine:latest AS first

RUN apk add python3 npm

WORKDIR /collaboration-server

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "run", "serve"]
