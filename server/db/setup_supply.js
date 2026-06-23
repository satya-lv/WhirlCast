'use strict';
/**
 * setup_supply.js — run once at server startup to ensure supply planning tables exist.
 *
 * - Migration is always run (CREATE TABLE IF NOT EXISTS — fully idempotent).
 * - Seed is skipped if planning_orders already has rows (preserves data across deploys).
 *   The in-app "Reset Supply Planning Data" button bypasses this guard via seedSupply(true).
 */
const runMigration = require('./migrate_supply');
const seedSupply   = require('./seed_supply');

console.log('[setup_supply] Running supply planning migration...');
runMigration();
console.log('[setup_supply] Migration complete. Running supply seed (skipped if already seeded)...');
seedSupply();
console.log('[setup_supply] Setup complete.');
