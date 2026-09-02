'use strict';

const { PrismaClient } = require('@prisma/client');

// Singleton — safe to reuse across hot reloads with node --watch
const globalRef = globalThis;
const prisma = globalRef.__prisma ?? new PrismaClient({
  log: ['warn', 'error'],
});
if (!globalRef.__prisma) globalRef.__prisma = prisma;

module.exports = { prisma };
