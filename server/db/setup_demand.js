'use strict';
const runDemandMigration = require('./migrate_demand');
const { seedDemand, computeAbcXyzClassification } = require('./seed_demand');
const { getDb } = require('./schema');

console.log('[setup_demand] Running demand planning migration...');
runDemandMigration();
console.log('[setup_demand] Migration complete. Running demand seed (skipped if already seeded)...');
seedDemand();
console.log('[setup_demand] Running ABC/XYZ classification (always runs, regardless of seed)...');
const db = getDb();
computeAbcXyzClassification(db);
db.close();
console.log('[setup_demand] Setup complete.');
