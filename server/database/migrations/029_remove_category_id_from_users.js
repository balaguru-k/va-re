exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropForeign('category_id');
    table.dropColumn('category_id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.integer('category_id').unsigned().nullable();
    table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL');
  });
};