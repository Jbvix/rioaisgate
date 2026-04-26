FROM node:20-alpine

WORKDIR /app/backend

# Install production dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

EXPOSE 3001

CMD ["node", "src/index.js"]
