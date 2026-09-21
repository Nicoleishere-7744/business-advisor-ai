import { PrismaClient } from "@prisma/client";

// در حالت توسعه Next.js ماژول‌ها را چند بار بارگذاری می‌کند؛
// نگهداری نمونه روی globalThis از ساخت کانکشن‌های تکراری جلوگیری می‌کند.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
