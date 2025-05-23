import { PrismaClient } from '@prisma/client';

// Declare a global variable to store the PrismaClient instance
// In JavaScript, you don't need the 'as unknown as' type assertions.
// We just declare it, and it will be implicitly typed at runtime.
const globalForPrisma = global; // In Node.js, 'global' is the global object

export const prisma =
  globalForPrisma.prisma || // Check if an instance already exists on the global object
  new PrismaClient({       // If not, create a new one
    log: ['query'],         // Log all database queries
  });

// In development, store the PrismaClient instance on the global object.
// This prevents new instances from being created on every hot reload,
// which can exhaust database connections.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}