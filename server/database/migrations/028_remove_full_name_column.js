exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('full_name');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.string('full_name', 100).notNullable();
  });
};