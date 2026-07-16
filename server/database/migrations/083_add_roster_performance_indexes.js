/**
 * Add performance indexes to rosters, daily_checklist_instances, and tickets tables
 * Fixes:
 *   1. SELECT * FROM rosters WHERE is_active = 1 (scanning 90,660 rows)
 *   2. NOT EXISTS subquery on daily_checklist_instances.daily_checklist_id (scanning 90,658 rows)
 *   3. SELECT FROM tickets WHERE location = 'x' AND deleted_at IS NULL (scanning 90,662 rows)
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('rosters', function(table) {
      table.index(['is_active', 'checklist_id'], 'idx_rosters_active_checklist');
      table.index(['is_active', 'auditor_id'], 'idx_rosters_active_auditor');
      table.index('checklist_id', 'idx_rosters_checklist_id');
    })
   
    .alterTable('daily_checklist_instances', function(table) {
      table.index('daily_checklist_id', 'idx_dci_daily_checklist_id');
    })
    .alterTable('tickets', function(table) {
      table.index(['location', 'deleted_at'], 'idx_tickets_location_deleted');
      table.index(['user_id', 'deleted_at', 'created_at'], 'idx_tickets_user_deleted_created');
    })
    .alterTable('users', function(table) {
      table.index('is_active', 'idx_users_is_active');
    })
    .alterTable('departments', function(table) {
      table.index('name', 'idx_departments_name');
    })
    .alterTable('daily_checklist_instances', function(table) {
      table.index(['assigned_date', 'daily_checklist_id'], 'idx_dci_assigned_date_checklist');
    })
    .alterTable('supervisor_reviews', function(table) {
      table.index(['checklist_id', 'checklist_item_id', 'updated_at'], 'idx_supervisor_reviews_checklist_item');
    })
    .alterTable('manager_reviews', function(table) {
      table.index(['checklist_id', 'checklist_item_id', 'updated_at'], 'idx_manager_reviews_checklist_item');
    })
    .alterTable('checklist_data', function(table) {
      table.index(['status', 'checklist_id'], 'idx_checklist_data_status_checklist');
    });
};
 
exports.down = function(knex) {
  return knex.schema
    .alterTable('rosters', function(table) {
      table.dropIndex(null, 'idx_rosters_active_checklist');
      table.dropIndex(null, 'idx_rosters_active_auditor');
      table.dropIndex(null, 'idx_rosters_checklist_id');
    })
    .alterTable('daily_checklist_instances', function(table) {
      table.dropIndex(null, 'idx_dci_daily_checklist_id');
    })
    .alterTable('tickets', function(table) {
      table.dropIndex(null, 'idx_tickets_location_deleted');
      table.dropIndex(null, 'idx_tickets_user_deleted_created');
    })
    .alterTable('users', function(table) {
      table.dropIndex(null, 'idx_users_is_active');
    })
    .alterTable('departments', function(table) {
      table.dropIndex(null, 'idx_departments_name');
    })
    .alterTable('daily_checklist_instances', function(table) {
      table.dropIndex(null, 'idx_dci_assigned_date_checklist');
    })
    .alterTable('supervisor_reviews', function(table) {
      table.dropIndex(null, 'idx_supervisor_reviews_checklist_item');
    })
    .alterTable('manager_reviews', function(table) {
      table.dropIndex(null, 'idx_manager_reviews_checklist_item');
    })
    .alterTable('checklist_data', function(table) {
      table.dropIndex(null, 'idx_checklist_data_status_checklist');
    });
};