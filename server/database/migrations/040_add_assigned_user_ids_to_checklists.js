exports.up = function(knex) {
  return knex.schema.table('checklists', function(table) {
    table.integer('assigned_auditor_id').unsigned().nullable();
    table.integer('assigned_supervisor_id').unsigned().nullable();
    table.integer('assigned_reviewer_id').unsigned().nullable();
    table.integer('assigned_manager_id').unsigned().nullable();
    table.integer('assigned_executive_id').unsigned().nullable();
    
    table.foreign('assigned_auditor_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('assigned_supervisor_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('assigned_reviewer_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('assigned_manager_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('assigned_executive_id').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.table('checklists', function(table) {
    table.dropForeign('assigned_auditor_id');
    table.dropForeign('assigned_supervisor_id');
    table.dropForeign('assigned_reviewer_id');
    table.dropForeign('assigned_manager_id');
    table.dropForeign('assigned_executive_id');
    
    table.dropColumn('assigned_auditor_id');
    table.dropColumn('assigned_supervisor_id');
    table.dropColumn('assigned_reviewer_id');
    table.dropColumn('assigned_manager_id');
    table.dropColumn('assigned_executive_id');
  });
};
