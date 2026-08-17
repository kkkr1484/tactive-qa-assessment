import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Turbopack to use the project directory as root (avoids lockfile warnings)
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Prisma adapter and better-sqlite3 need to run in Node.js (not Edge runtime)
  serverExternalPackages: ['@prisma/adapter-better-sqlite3', 'better-sqlite3', '@prisma/client'],
};

export default nextConfig;

