FROM node:18-bullseye-slim

COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install 

# Copy source code
COPY . .


CMD ["yarn", "start"]
