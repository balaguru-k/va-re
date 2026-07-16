exports.up = async function(knex) {
  // Check if columns exist first
  const hasColumns = await knex.schema.hasColumn('daily_checklist_instances', 'supervisor_id');
  
  if (!hasColumns) {
    // Drop foreign key constraints first if they exist
    await knex.raw('ALTER TABLE daily_checklist_instances DROP FOREIGN KEY IF EXISTS daily_checklist_instances_supervisor_id_foreign');
    await knex.raw('ALTER TABLE daily_checklist_instances DROP FOREIGN KEY IF EXISTS daily_checklist_instances_manager_id_foreign');
    
    // Add supervisor_id and manager_id columns as TEXT to store JSON arrays
    await knex.schema.table('daily_checklist_instances', function(table) {
      table.text('supervisor_id').nullable();
      table.text('manager_id').nullable();
    });
  } else {
    // Columns exist, modify them to TEXT if they're not already
    await knex.raw('ALTER TABLE daily_checklist_instances DROP FOREIGN KEY IF EXISTS daily_checklist_instances_supervisor_id_foreign');
    await knex.raw('ALTER TABLE daily_checklist_instances DROP FOREIGN KEY IF EXISTS daily_checklist_instances_manager_id_foreign');
    await knex.raw('ALTER TABLE daily_checklist_instances MODIFY COLUMN supervisor_id TEXT');
    await knex.raw('ALTER TABLE daily_checklist_instances MODIFY COLUMN manager_id TEXT');
  }
};

exports.down = async function(knex) {
  await knex.schema.table('daily_checklist_instances', function(table) {
    table.dropColumn('supervisor_id');
    table.dropColumn('manager_id');
  });
};