exports.up = function(knex) {
  return knex.schema.alterTable('checklist_items', function(table) {
    table.json('meta').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklist_items', function(table) {
    table.dropColumn('meta');
  });
};