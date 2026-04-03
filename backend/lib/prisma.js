const { PrismaClient } = require('@prisma/client')

// P1 Fix: Singleton PrismaClient — dùng chung toàn app thay vì mỗi route file tạo instance riêng
// Trước: 6 file × new PrismaClient() = 6 connection pool → ~18 connections chiếm sẵn
// Sau: 1 instance duy nhất → 1 pool, tối đa ~3 connections trên Render free tier
const prisma = new PrismaClient()

module.exports = prisma
