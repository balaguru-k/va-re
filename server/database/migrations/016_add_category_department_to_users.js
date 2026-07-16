exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.integer('category_id').unsigned().nullable();
    table.integer('department_id').unsigned().nullable();
    
    table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL');
    table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropForeign('category_id');
    table.dropForeign('department_id');
    table.dropColumn('category_id');
    table.dropColumn('department_id');
  });
};