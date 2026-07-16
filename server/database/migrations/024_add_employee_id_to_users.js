exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.string('employee_id').nullable().after('department_id');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('employee_id');
  });
};