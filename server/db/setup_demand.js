'use strict';
const runDemandMigration = require('./migrate_demand');
const { seedDemand } = require('./seed_demand');

console.log('[setup_demand] Running demand planning migration...');
runDemandMigration();
console.log('[setup_demand] Migration complete. Running demand seed (skipped if already seeded)...');
seedDemand();
console.log('[setup_demand] Setup complete.');
