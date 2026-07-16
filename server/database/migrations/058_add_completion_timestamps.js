exports.up = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    // Add completion timestamp fields
    table.timestamp('completed_at').nullable();
    table.timestamp('vendor_completed_at').nullable();
    table.timestamp('engineer_completed_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.dropColumn('completed_at');
    table.dropColumn('vendor_completed_at');
    table.dropColumn('engineer_completed_at');
  });
};