exports.up = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.integer('roster_id').unsigned().nullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('daily_checklist_instances', function(table) {
    table.integer('roster_id').unsigned().notNullable().alter();
  });
};