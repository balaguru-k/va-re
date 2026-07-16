exports.up = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.json('supervisor_id').nullable().comment('JSON array of supervisor IDs');
    table.json('manager_id').nullable().comment('JSON array of manager IDs');
    table.integer('responsible_person_id').unsigned().nullable();
    
    table.foreign('responsible_person_id').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.dropForeign(['responsible_person_id']);
    table.dropColumn('supervisor_id');
    table.dropColumn('manager_id');
    table.dropColumn('responsible_person_id');
  });
};