exports.up = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.integer('admin_aging').nullable();
    table.integer('vendor_aging').nullable();
    table.integer('engineer_aging').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.dropColumn('admin_aging');
    table.dropColumn('vendor_aging');
    table.dropColumn('engineer_aging');
  });
};
