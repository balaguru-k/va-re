exports.up = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.timestamp('deleted_at').nullable().defaultTo(null);
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.dropColumn('deleted_at');
  });
};
