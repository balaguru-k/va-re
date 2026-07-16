exports.up = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.string('division', 100).nullable();
    table.string('cc', 100).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.dropColumn('division');
    table.dropColumn('cc');
  });
};
