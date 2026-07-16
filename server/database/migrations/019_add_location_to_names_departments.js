exports.up = function(knex) {
  return knex.schema.alterTable('names', function(table) {
    table.integer('location_id').unsigned().nullable();
    table.foreign('location_id').references('id').inTable('locations').onDelete('SET NULL');
  }).then(() => {
    return knex.schema.alterTable('departments', function(table) {
      table.integer('location_id').unsigned().nullable();
      table.foreign('location_id').references('id').inTable('locations').onDelete('SET NULL');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('names', function(table) {
    table.dropForeign('location_id');
    table.dropColumn('location_id');
  }).then(() => {
    return knex.schema.alterTable('departments', function(table) {
      table.dropForeign('location_id');
      table.dropColumn('location_id');
    });
  });
};