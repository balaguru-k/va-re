exports.up = function(knex) {
  return knex.schema.createTable('checklist_items', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.string('type', 100).nullable();
    table.string('process', 200).nullable();
    table.string('camera_number', 50).nullable();
    table.string('criticality', 50).nullable();
    table.text('activities').nullable();
    table.string('who', 100).nullable();
    table.string('when_field', 100).nullable(); // 'when' is reserved keyword
    table.text('how').nullable();
    table.string('frequency', 50).nullable();
    table.integer('status').defaultTo(0);
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('checklist_items');
};