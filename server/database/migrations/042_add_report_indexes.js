exports.up = function(knex) {
  return knex.schema
    .table('daily_checklist_instances', function(table) {
      table.index('daily_checklist_id', 'idx_dci_daily_checklist_id');
      table.index('template_checklist_id', 'idx_dci_template_checklist_id');
      table.index(['daily_checklist_id', 'template_checklist_id'], 'idx_dci_daily_template');
    })
    .table('checklist_data', function(table) {
      table.index('checklist_id', 'idx_cd_checklist_id');
      table.index('checklist_item_id', 'idx_cd_item_id');
      table.index('user_id', 'idx_cd_user_id');
      table.index('status', 'idx_cd_status');
      table.index(['checklist_id', 'checklist_item_id'], 'idx_cd_checklist_item');
    })
    .table('supervisor_reviews', function(table) {
      table.index('checklist_id', 'idx_sr_checklist_id');
      table.index('checklist_item_id', 'idx_sr_item_id');
      table.index('supervisor_id', 'idx_sr_supervisor_id');
      table.index(['checklist_id', 'checklist_item_id'], 'idx_sr_checklist_item');
    })
    .table('manager_reviews', function(table) {
      table.index('checklist_id', 'idx_mr_checklist_id');
      table.index('checklist_item_id', 'idx_mr_item_id');
      table.index('manager_id', 'idx_mr_manager_id');
      table.index(['checklist_id', 'checklist_item_id'], 'idx_mr_checklist_item');
    })
    .table('checklists', function(table) {
      table.index('created_at', 'idx_checklists_created_at');
      table.index('status', 'idx_checklists_status');
      table.index('location_id', 'idx_checklists_location_id');
      table.index('department_id', 'idx_checklists_department_id');
    })
    .table('checklist_items', function(table) {
      table.index('checklist_id', 'idx_ci_checklist_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('daily_checklist_instances', function(table) {
      table.dropIndex('daily_checklist_id', 'idx_dci_daily_checklist_id');
      table.dropIndex('template_checklist_id', 'idx_dci_template_checklist_id');
      table.dropIndex(['daily_checklist_id', 'template_checklist_id'], 'idx_dci_daily_template');
    })
    .table('checklist_data', function(table) {
      table.dropIndex('checklist_id', 'idx_cd_checklist_id');
      table.dropIndex('checklist_item_id', 'idx_cd_item_id');
      table.dropIndex('user_id', 'idx_cd_user_id');
      table.dropIndex('status', 'idx_cd_status');
      table.dropIndex(['checklist_id', 'checklist_item_id'], 'idx_cd_checklist_item');
    })
    .table('supervisor_reviews', function(table) {
      table.dropIndex('checklist_id', 'idx_sr_checklist_id');
      table.dropIndex('checklist_item_id', 'idx_sr_item_id');
      table.dropIndex('supervisor_id', 'idx_sr_supervisor_id');
      table.dropIndex(['checklist_id', 'checklist_item_id'], 'idx_sr_checklist_item');
    })
    .table('manager_reviews', function(table) {
      table.dropIndex('checklist_id', 'idx_mr_checklist_id');
      table.dropIndex('checklist_item_id', 'idx_mr_item_id');
      table.dropIndex('manager_id', 'idx_mr_manager_id');
      table.dropIndex(['checklist_id', 'checklist_item_id'], 'idx_mr_checklist_item');
    })
    .table('checklists', function(table) {
      table.dropIndex('created_at', 'idx_checklists_created_at');
      table.dropIndex('status', 'idx_checklists_status');
      table.dropIndex('location_id', 'idx_checklists_location_id');
      table.dropIndex('department_id', 'idx_checklists_department_id');
    })
    .table('checklist_items', function(table) {
      table.dropIndex('checklist_id', 'idx_ci_checklist_id');
    });
};
