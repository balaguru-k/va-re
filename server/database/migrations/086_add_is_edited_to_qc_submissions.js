exports.up = function (knex) {
  return knex.schema.alterTable('qc_submissions', (table) => {
    table.boolean('is_edited').defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('qc_submissions', (table) => {
    table.dropColumn('is_edited');
  });
};
