FROM node:4.2

# Make sure we have the right version of npm
RUN npm install -g npm@2.14.7

# Add the package.json to use docker caching
ADD ../../package.json ./link/package.json
WORKDIR /link
RUN npm install

# Add the rest of the files
ADD ["../../", "/link"]

# TEST!
CMD npm run test
