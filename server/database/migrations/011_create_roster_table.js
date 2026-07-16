exports.up = function(knex) {
  return knex.schema.createTable('rosters', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('auditor_id').unsigned().notNullable();
    table.integer('responsible_person_id').unsigned().nullable();
    table.integer('manager_id').unsigned().nullable();
    table.integer('supervisor_id').unsigned().nullable();
    table.date('assigned_date').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by').unsigned().notNullable();
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('auditor_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('responsible_person_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('manager_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('supervisor_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    
    table.index(['checklist_id', 'assigned_date']);
    table.index(['auditor_id', 'assigned_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rosters');
};