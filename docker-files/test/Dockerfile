FROM node:4.2

ENV LOG_LEVEL=error
ENV RABBITMQ_HOSTNAME=rabbitmq-testing-staging-codenow.runnableapp.com
ENV RABBITMQ_PORT=5672
ENV RABBITMQ_USERNAME=5WE5wsEQmfw9sLsppJ4CEq9Auea8mPC4kgVt3xYqKxbYHPfP
ENV RABBITMQ_PASSWORD=h7n972sPLs5tWGCWe6QPSCnaxDWjvnpEFEA9c9mBqauH3f22
ENV API_URL=http://api-staging-codenow.runnableapp.com
ENV USER_CONTENT_DOMAIN=runnablecloud.com
ENV MONGO=mongodb://mongodb-testing-staging-codenow.runnableapp.com/navi
ENV NODE_ENV=STAGING
ENV HELLO_RUNNABLE_GITHUB_TOKEN=f2c7cda406f8be756afe499ca36d6988533db2d9

# Make sure we have the right version of npm
RUN npm install -g npm@2.14.7

# Add the package.json to use docker caching
ADD ./link/package.json ./link/package.json
WORKDIR /link
RUN npm install

# Add the rest of the files
ADD ["./link", "/link"]

# TEST!
CMD npm run test
