exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropForeign('department_id');
    table.dropColumn('department_id');
  }).then(() => {
    return knex.schema.alterTable('users', function(table) {
      table.json('department_id').nullable();
    });
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('department_id');
  }).then(() => {
    return knex.schema.alterTable('users', function(table) {
      table.integer('department_id').unsigned().nullable();
      table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
    });
  });
};
