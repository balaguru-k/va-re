const knex = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    // Check if --fresh flag is passed
    const isFresh = process.argv.includes('--fresh');
    
    if (isFresh) {
      console.log('Rolling back all migrations...');
      await knex.migrate.rollback(null, true);
      console.log('✓ Rollback completed');
    }

    const [batchNo, log] = await knex.migrate.latest();
    
    if (log.length === 0) {
      console.log('No new migrations to run.');
    } else {
      console.log(`✓ Batch ${batchNo} run: ${log.length} migrations`);
      log.forEach(file => console.log(`  - ${file}`));
    }
    
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();