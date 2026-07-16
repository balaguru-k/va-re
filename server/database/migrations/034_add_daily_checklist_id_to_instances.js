exports.up = function(knex) {
  return knex.schema.table('daily_checklist_instances', function(table) {
    table.integer('daily_checklist_id').unsigned().nullable();
    table.foreign('daily_checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.table('daily_checklist_instances', function(table) {
    table.dropForeign('daily_checklist_id');
    table.dropColumn('daily_checklist_id');
  });
};