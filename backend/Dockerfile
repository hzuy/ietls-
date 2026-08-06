# ── Production image ─────────────────────────────────────────────
# Dùng node:20-slim (Debian-based) thay vì Alpine để tránh lỗi
# Prisma engine không tìm được libssl.so.1.1 trên Alpine 3.17+ (OpenSSL 3.x)
FROM node:20-slim

# OpenSSL cần thiết cho Prisma query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma Client (cần sau khi COPY schema.prisma)
RUN npx prisma generate

# Tạo thư mục uploads
RUN mkdir -p uploads/thumbnails uploads/audio

EXPOSE 5001

CMD ["node", "server.js"]
