exports.up = function (knex) {
  return knex.schema.alterTable('qc_submission_items', (table) => {
    table.boolean('is_new_item').defaultTo(false);
    table.string('activities', 255).nullable();
    table.string('process', 255).nullable();
    table.string('criticality', 50).nullable();
    table.string('status', 50).nullable();
    table.text('reason').nullable();
    table.text('item_images').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('qc_submission_items', (table) => {
    table.dropColumn('is_new_item');
    table.dropColumn('activities');
    table.dropColumn('process');
    table.dropColumn('criticality');
    table.dropColumn('status');
    table.dropColumn('reason');
    table.dropColumn('item_images');
  });
};
