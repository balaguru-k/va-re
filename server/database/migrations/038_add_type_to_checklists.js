exports.up = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.enum('type', ['NORMAL', 'SC']).defaultTo('NORMAL').after('checklist_name');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.dropColumn('type');
  });
};