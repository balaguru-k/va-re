exports.up = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.string('vendor_status', 50).nullable();
    table.text('vendor_remarks').nullable();
    table.string('engineer_status', 50).nullable();
    table.text('engineer_remarks').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.dropColumn('vendor_status');
    table.dropColumn('vendor_remarks');
    table.dropColumn('engineer_status');
    table.dropColumn('engineer_remarks');
  });
};
