exports.up = function(knex) {
  return knex.schema.createTable('supervisor_reviews', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('checklist_item_id').unsigned().notNullable();
    table.integer('supervisor_id').unsigned().notNullable();
    table.enum('status', ['Open', 'Close']).notNullable(); // Status: Open/Close
    table.text('reason').nullable(); // Reason for status
    table.text('supervisor_images').nullable(); // Supervisor uploaded images
    table.enum('reason_category', ['Process Training', 'Review-Attitude', 'Review-Corrective action', 'Others']).nullable();
    table.enum('supervisor_status', ['Accepted', 'Rejected']).notNullable(); // Final decision
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('checklist_item_id').references('id').inTable('checklist_items').onDelete('CASCADE');
    table.foreign('supervisor_id').references('id').inTable('users').onDelete('CASCADE');
    
    table.unique(['checklist_id', 'checklist_item_id']); // One supervisor review per item
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('supervisor_reviews');
};