exports.up = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.integer('executive_id').unsigned().nullable().after('auditor_id');
    table.json('executive_images').nullable().after('executive_id');
    table.text('executive_reason').nullable().after('executive_images');
    
    table.foreign('executive_id').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.dropForeign('executive_id');
    table.dropColumn('executive_id');
    table.dropColumn('executive_images');
    table.dropColumn('executive_reason');
  });
};