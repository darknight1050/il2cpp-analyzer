# syntax=docker/dockerfile:1

# Dependencies are installed before the source is copied so that the install
# layer stays cached across code changes.
FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package.json yarn.lock ./

# --- development: full dependency set, hot reload through nodemon ----------
FROM base AS dev
ENV NODE_ENV=development
RUN yarn install --frozen-lockfile
COPY . .
EXPOSE 5000
CMD ["yarn", "dev"]

# --- production (default target): runtime dependencies only ----------------
FROM base AS prod
ENV NODE_ENV=production
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY . .
EXPOSE 5000
CMD ["yarn", "start"]
