exports.up = function(knex) {
  return knex.schema.alterTable('departments', function(table) {
    table.integer('name_id').unsigned().nullable().after('location_id');
    table.foreign('name_id').references('id').inTable('names').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('departments', function(table) {
    table.dropForeign('name_id');
    table.dropColumn('name_id');
  });
};
