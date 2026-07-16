exports.up = function(knex) {
  // First, update any NULL values to empty string
  return knex('checklists')
    .whereNull('name')
    .update({ name: '' })
    .then(() => {
      // Then make the field not nullable
      return knex.schema.alterTable('checklists', function(table) {
        table.string('name', 255).notNullable().defaultTo('').alter();
      });
    });
};

exports.down = function(knex) {
  return knex.schema.alterTable('checklists', function(table) {
    table.string('name', 255).nullable().alter();
  });
};