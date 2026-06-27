# Build stage runs on the NATIVE build platform (amd64 here), not the target
# arch. The React build only produces static HTML/JS/CSS, which is
# architecture-independent, so this avoids slow/unstable QEMU emulation of npm.
FROM --platform=$BUILDPLATFORM node:18 AS build

WORKDIR /app

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

ARG REACT_APP_SHOW_DOWNLOADED_COL=false
ENV REACT_APP_SHOW_DOWNLOADED_COL=$REACT_APP_SHOW_DOWNLOADED_COL

COPY package*.json ./
RUN for i in 1 2 3 4 5; do \
      echo "Attempt $i: npm install" && \
      npm install && break; \
      echo "npm install failed (attempt $i/5)"; \
      [ "$i" = "5" ] && exit 1; \
      sleep 5; \
    done

# Added to debug
RUN npm install

RUN which npm
RUN npm ls react-scripts
RUN ls -l node_modules/.bin/react-scripts
# end added

COPY . .

# start added to debug 
RUN npm ls react-scripts
RUN ls -l node_modules/.bin/react-scripts
# end added 
RUN npm run build

# Final runtime image is built for the target arch (arm64 for the Pis).
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

