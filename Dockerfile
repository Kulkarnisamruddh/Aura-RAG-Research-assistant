# ==========================================
# Stage 1: Build Frontend (Vite)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Pass build-time Vite environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

# Copy source and build frontend
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production Server Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server files and built frontend
COPY server.js ./
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Run the Express server
CMD ["node", "server.js"]
