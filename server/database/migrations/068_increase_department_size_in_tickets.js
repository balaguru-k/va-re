exports.up = function(knex) {
  return knex.schema.alterTable('tickets', function(table) {
    table.string('department', 500).nullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('tickets', function(table) {
    table.string('department', 100).nullable().alter();
  });
};
