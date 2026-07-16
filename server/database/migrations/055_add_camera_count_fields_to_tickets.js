exports.up = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.integer('checklist_camera_count').unsigned().nullable().after('department');
    table.integer('camera_count').unsigned().nullable().after('checklist_camera_count');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', function(table) {
    table.dropColumn('checklist_camera_count');
    table.dropColumn('camera_count');
  });
};
