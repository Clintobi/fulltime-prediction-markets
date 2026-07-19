FROM node:22-bookworm-slim

WORKDIR /fulltime
COPY package.json package-lock.json ./
COPY keeper/package.json keeper/policy.mjs keeper/policy.test.mjs ./keeper/
COPY tests/hermetic/package.json tests/hermetic/package-lock.json ./tests/hermetic/
RUN npm ci --prefix tests/hermetic --ignore-scripts

COPY keeper ./keeper
COPY tests/hermetic ./tests/hermetic
COPY scripts ./scripts

CMD ["npm", "run", "judge:check"]
