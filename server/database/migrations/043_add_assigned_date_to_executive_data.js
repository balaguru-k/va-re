exports.up = function(knex) {
  return knex.schema.alterTable('executive_data', function(table) {
    table.date('assigned_date').nullable().after('checklist_item_id');
  }).then(() => {
    // Drop old unique key, add new one including assigned_date
    return knex.schema.alterTable('executive_data', function(table) {
      table.dropUnique(['checklist_id', 'user_id', 'checklist_item_id']);
      table.unique(['checklist_id', 'user_id', 'checklist_item_id', 'assigned_date']);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('executive_data', function(table) {
    table.dropUnique(['checklist_id', 'user_id', 'checklist_item_id', 'assigned_date']);
    table.unique(['checklist_id', 'user_id', 'checklist_item_id']);
    table.dropColumn('assigned_date');
  });
};
