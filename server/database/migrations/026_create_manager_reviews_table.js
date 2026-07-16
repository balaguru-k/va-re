const knex = require('knex');

exports.up = function(knex) {
  return knex.schema.createTable('manager_reviews', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('checklist_item_id').unsigned().notNullable();
    table.integer('manager_id').unsigned().notNullable();
    table.text('reason').nullable();
    table.enum('manager_status', ['Approved', 'Rejected']).nullable();
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('checklist_item_id').references('id').inTable('checklist_items').onDelete('CASCADE');
    table.foreign('manager_id').references('id').inTable('users').onDelete('CASCADE');
    
    table.unique(['checklist_id', 'checklist_item_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('manager_reviews');
};