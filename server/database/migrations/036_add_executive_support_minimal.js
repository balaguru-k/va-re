exports.up = function(knex) {
  return knex.schema.table('daily_checklist_instances', function(table) {
    // Add executive_id to support executive assignments
    table.integer('executive_id').unsigned().nullable();
    table.foreign('executive_id').references('id').inTable('users').onDelete('SET NULL');
  }).then(() => {
    return knex.schema.table('checklists', function(table) {
      table.string('type', 10).defaultTo('NORMAL');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.table('daily_checklist_instances', function(table) {
    table.dropForeign(['executive_id']);
    table.dropColumn('executive_id');
  }).then(() => {
    return knex.schema.table('checklists', function(table) {
      table.dropColumn('type');
    });
  });
};