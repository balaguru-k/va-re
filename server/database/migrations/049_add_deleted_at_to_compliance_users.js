exports.up = async function (knex) {
  await knex.schema.table('compliance_users', (table) => {
    table.timestamp('deleted_at').nullable().defaultTo(null);
  });
};

exports.down = async function (knex) {
  await knex.schema.table('compliance_users', (table) => {
    table.dropColumn('deleted_at');
  });
};
