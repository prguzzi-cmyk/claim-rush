# Angular serving the content
FROM node:12.18-alpine3.12

# Install required dependencies
RUN apk add --no-cache \
    make nasm autoconf automake libtool dpkg pkgconfig libpng libpng-dev g++ && \
    apk add vips-dev fftw-dev --update-cache \
    && rm -fR /var/cache/apk/*

# Setup Environment variables
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

# Install node dependencies
RUN npm install --legacy-peer-deps

# Install Angular cli tool
RUN npm install -g @angular/cli@16.1.1

# Build the project
RUN ng build --verbose --configuration production

# Expose Ports
EXPOSE 80 9000

# Run Command
CMD ["npm", "run", "serve"]
