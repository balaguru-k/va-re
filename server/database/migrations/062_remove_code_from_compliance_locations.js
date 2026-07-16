exports.up = async function (knex) {
  await knex.schema.table('compliance_locations', (table) => {
    table.dropColumn('code');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('compliance_locations', (table) => {
    table.string('code', 20).nullable();
  });
};