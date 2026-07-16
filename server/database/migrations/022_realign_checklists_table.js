exports.up = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.string('checklist_name', 255).alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.string('checklist_name', 100).alter();
  });
};