# ── Stage: production ────────────────────────────────────────────
FROM node:20-alpine

# Thư mục làm việc bên trong container
WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package.json package-lock.json ./

# Install dependencies (bao gồm devDeps vì cần prisma CLI)
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Generate Prisma Client (cần schema.prisma có sẵn)
RUN npx prisma generate

# Tạo thư mục uploads (tránh lỗi multer khi chưa có folder)
RUN mkdir -p uploads/thumbnails uploads/audio

# Expose port (chỉ để document — binding thực tế do docker-compose)
EXPOSE 5001

# Khởi động server
CMD ["node", "server.js"]
