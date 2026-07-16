exports.up = function(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.boolean('is_first_login').defaultTo(true);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_first_login');
  });
};
