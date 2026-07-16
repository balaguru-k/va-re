exports.up = function(knex) {
  return knex.schema.alterTable('rotation_temp_swaps', function(table) {
    table.integer('temp_auditor_id').unsigned().nullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('rotation_temp_swaps', function(table) {
    table.integer('temp_auditor_id').unsigned().notNullable().alter();
  });
};
