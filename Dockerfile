# TextStory Web — production Docker image (multi-stage).
#
# Stage 1: Install all deps + build Next.js (needs Tailwind/PostCSS).
# Stage 2: Copy only production artifacts to a slim runtime image.

# --- Builder stage ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDeps like Tailwind) for build
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# --- Runtime stage ---
FROM node:22-bookworm-slim

# Install system deps for video export pipeline
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-inter \
    fonts-noto-color-emoji \
    fonts-roboto \
    wget \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

# Copy built app + production node_modules from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create temp directories for export pipeline
RUN mkdir -p /tmp/textstory/{uploads,exports,jobs}

EXPOSE 3000
CMD ["npm", "start"]
