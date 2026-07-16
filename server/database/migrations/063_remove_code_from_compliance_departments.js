exports.up = async function (knex) {
  await knex.schema.table('compliance_departments', (table) => {
    table.dropColumn('code');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('compliance_departments', (table) => {
    table.string('code', 20).nullable();
  });
};