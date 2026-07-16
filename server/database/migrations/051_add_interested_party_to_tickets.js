exports.up = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.json('interested_party').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.dropColumn('interested_party');
  });
};
