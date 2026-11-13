FROM node:20-slim

WORKDIR /app

# Build-time API URLs baked into the static bundle by Vite.
# Defaults match frontend/.env.example and line up with the ports this
# image's docker-compose service publishes, so no extra config is needed
# to run on a fresh laptop.
ARG VITE_API_BASE_URL=http://127.0.0.1:8000
ARG VITE_WS_BASE_URL=ws://127.0.0.1:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL

# Install dependencies first so they are cached unless package files change
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the production bundle
COPY . .
RUN npm run build

EXPOSE 5173

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD node -e "fetch('http://localhost:5173').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Serve the built static files with Vite's preview server (no nginx / multi-stage needed)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
