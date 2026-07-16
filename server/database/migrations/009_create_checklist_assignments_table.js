exports.up = function(knex) {
  return knex.schema.createTable('checklist_assignments', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('auditor_id').unsigned().notNullable();
    table.integer('responsible_person_id').unsigned().nullable();
    table.integer('supervisor_id').unsigned().nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('auditor_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('responsible_person_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('supervisor_id').references('id').inTable('users').onDelete('SET NULL');
    
    table.unique(['checklist_id', 'auditor_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('checklist_assignments');
};