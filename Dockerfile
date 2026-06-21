FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV DATA_DIR=/var/data
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY public ./public
COPY server.js ./
COPY README.md ./

RUN mkdir -p /var/data

EXPOSE 10000

CMD ["npm", "start"]
