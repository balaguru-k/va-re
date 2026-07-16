exports.up = function(knex) {
  return knex.schema.createTable('executive_data', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('user_id').unsigned().notNullable();
    table.integer('checklist_item_id').unsigned().notNullable();
    table.text('reason').nullable();
    table.text('image_name').nullable();
    table.enum('submission_status', ['draft', 'completed']).defaultTo('draft');
    table.timestamps(true, true);
    
    // Foreign key constraints
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('checklist_item_id').references('id').inTable('checklist_items').onDelete('CASCADE');
    
    // Unique constraint to prevent duplicate entries
    table.unique(['checklist_id', 'user_id', 'checklist_item_id']);
    
    // Indexes for better performance
    table.index(['checklist_id', 'user_id']);
    table.index('submission_status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('executive_data');
};