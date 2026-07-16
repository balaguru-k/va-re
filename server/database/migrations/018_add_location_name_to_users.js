exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.integer('location_id').unsigned().nullable();
    table.integer('name_id').unsigned().nullable();
    
    table.foreign('location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.foreign('name_id').references('id').inTable('names').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropForeign('location_id');
    table.dropForeign('name_id');
    table.dropColumn('location_id');
    table.dropColumn('name_id');
  });
};