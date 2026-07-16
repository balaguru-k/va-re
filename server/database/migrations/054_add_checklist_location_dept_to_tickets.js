exports.up = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.integer('checklist_id').unsigned().nullable().after('user_id');
    table.string('location', 100).nullable().after('checklist_id');
    table.string('department', 100).nullable().after('location');
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('SET NULL').onUpdate('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.dropForeign('checklist_id');
    table.dropColumn('checklist_id');
    table.dropColumn('location');
    table.dropColumn('department');
  });
};
