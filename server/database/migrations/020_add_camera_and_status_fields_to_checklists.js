exports.up = async function(knex) {
  const hasStatus = await knex.schema.hasColumn('checklists', 'status');
  const hasCameraAudited = await knex.schema.hasColumn('checklists', 'total_camera_audited');
  
  return knex.schema.table('checklists', (table) => {
    if (!hasStatus) {
      table.enum('status', ['Completed without NCs', 'Awaiting for NC response', 'Pending TL verification', 'Completed']).nullable();
    }
    if (!hasCameraAudited) {
      table.integer('total_camera_audited').nullable();
      table.integer('total_camera_random_audited').nullable();
      table.integer('total_camera_not_audited').nullable();
      table.integer('total_camera_offline').nullable();
      table.decimal('total_camera_offline_percent', 5, 2).nullable();
      table.integer('total_camera_technical_issues').nullable();
      table.decimal('total_camera_technical_issues_percent', 5, 2).nullable();
      table.integer('total_ncs').nullable();
      table.string('camera_file').nullable();
      table.text('remark').nullable();
      table.integer('time_taken_seconds').nullable();
    }
  });
};

exports.down = function(knex) {
  return knex.schema.table('checklists', (table) => {
    table.dropColumn('total_camera_audited');
    table.dropColumn('total_camera_random_audited');
    table.dropColumn('total_camera_not_audited');
    table.dropColumn('total_camera_offline');
    table.dropColumn('total_camera_offline_percent');
    table.dropColumn('total_camera_technical_issues');
    table.dropColumn('total_camera_technical_issues_percent');
    table.dropColumn('total_ncs');
    table.dropColumn('camera_file');
    table.dropColumn('remark');
    table.dropColumn('status');
    table.dropColumn('time_taken_seconds');
  });
};