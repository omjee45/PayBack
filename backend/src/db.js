'use strict';

const { PrismaClient } = require('@prisma/client');

// Singleton — safe to reuse across hot reloads with node --watch
const globalRef = globalThis;

if (!globalRef.__prisma) {
  const client = new PrismaClient({
    log: ['warn', 'error'],
  });

  // SQLite does NOT enforce foreign keys by default.
  // This PRAGMA makes orphaned rows (e.g. invoice pointing to deleted debtor)
  // structurally impossible — the DB will reject the DELETE instead.
  client.$connect().then(() =>
    client.$queryRawUnsafe('PRAGMA foreign_keys = ON')
  ).catch(err => console.error('[db] Failed to enable foreign_keys pragma:', err.message));

  globalRef.__prisma = client;
}

const prisma = globalRef.__prisma;

module.exports = { prisma };
