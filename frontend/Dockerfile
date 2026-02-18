FROM node:18 AS build

WORKDIR /app

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

COPY package*.json ./
RUN for i in 1 2 3 4 5; do \
      echo "Attempt $i: npm install" && \
      npm install && break || \
      echo "npm install failed. Retrying in 5s..." && \
      sleep 5; \
    done

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

