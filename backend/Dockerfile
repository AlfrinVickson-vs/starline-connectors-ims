# ============================================================
# Stage 1: Build / install dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install OS-level Chromium dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm ci --omit=dev

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Copy Chromium deps from deps stage
COPY --from=deps /usr/bin/chromium-browser /usr/bin/chromium-browser
COPY --from=deps /usr/lib/chromium /usr/lib/chromium
COPY --from=deps /usr/share/chromium /usr/share/chromium

# Copy Puppeteer env vars
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 appuser

# Copy node_modules and application
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set ownership
RUN chown -R appuser:nodejs /app

USER appuser

# Cloud Run requires the app to listen on $PORT (default 8080)
EXPOSE 8080

CMD ["node", "src/app.js"]
