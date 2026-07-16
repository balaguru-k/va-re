exports.up = function(knex) {
  return knex.schema.alterTable('checklist_assignments', function(table) {
    table.integer('manager_id').unsigned().nullable();
    table.foreign('manager_id').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklist_assignments', function(table) {
    table.dropForeign('manager_id');
    table.dropColumn('manager_id');
  });
};