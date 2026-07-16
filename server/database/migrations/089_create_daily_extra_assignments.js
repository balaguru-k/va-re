exports.up = function(knex) {
  return knex.schema.createTable('daily_extra_assignments', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('auditor_id').unsigned().notNullable();
    table.date('assign_date').notNullable();
    table.integer('assigned_by').unsigned().notNullable();
    table.boolean('is_processed').defaultTo(false); // true once DCI created
    table.timestamps(true, true);

    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('auditor_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('assigned_by').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['checklist_id', 'auditor_id', 'assign_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('daily_extra_assignments');
};
