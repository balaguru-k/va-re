exports.up = function(knex) {
  return knex.schema.createTable('daily_checklist_instances', function(table) {
    table.increments('id').primary();
    table.integer('template_checklist_id').unsigned().notNullable();
    table.integer('roster_id').unsigned().notNullable();
    table.integer('auditor_id').unsigned().notNullable();
    table.date('assigned_date').notNullable();
    table.datetime('completion_date').nullable();
    table.enum('status', [
      'assigned', 
      'in_progress', 
      'awaiting_supervisor', 
      'awaiting_manager', 
      'completed', 
      'completed_without_ncs'
    ]).defaultTo('assigned');
    table.string('daily_key', 100).notNullable();
    table.timestamps(true, true);
    
    table.foreign('template_checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('roster_id').references('id').inTable('rosters').onDelete('CASCADE');
    table.foreign('auditor_id').references('id').inTable('users').onDelete('CASCADE');
    
    table.unique(['template_checklist_id', 'roster_id', 'assigned_date'], 'unique_daily_assignment');
    table.index(['assigned_date', 'auditor_id']);
    table.index(['daily_key']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('daily_checklist_instances');
};