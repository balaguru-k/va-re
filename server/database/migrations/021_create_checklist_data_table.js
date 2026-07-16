exports.up = function(knex) {
  return knex.schema.createTable('checklist_data', (table) => {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('user_id').unsigned().notNullable();
    table.integer('checklist_item_id').unsigned().notNullable();
    table.string('status').nullable();
    table.string('category').nullable();
    table.string('reason').nullable();
    table.string('image_name').nullable();
    table.enum('submission_status', ['draft', 'completed']).nullable();
    table.timestamps(true, true);

    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('checklist_item_id').references('id').inTable('checklist_items').onDelete('CASCADE');
    table.index(['checklist_id', 'user_id','checklist_item_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('checklist_data');
};