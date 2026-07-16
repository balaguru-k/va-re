exports.up = function(knex) {
  return knex.schema.table('rosters', function(table) {
    table.text('supervisor_ids').nullable();
    table.text('manager_ids').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('rosters', function(table) {
    table.dropColumn('supervisor_ids');
    table.dropColumn('manager_ids');
  });
};