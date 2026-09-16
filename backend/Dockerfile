FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
