exports.up = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.integer('name_id').unsigned().nullable();
    table.foreign('name_id').references('id').inTable('names').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.dropForeign('name_id');
    table.dropColumn('name_id');
  });
};