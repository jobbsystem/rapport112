# Lightweight Playwright + Node base
FROM mcr.microsoft.com/playwright:focal

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY output ./output

# Expose API port
EXPOSE 3000

CMD ["npm", "run", "api"]
