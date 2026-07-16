exports.up = async function (knex) {
  await knex.schema.alterTable('compliance_users', (table) => {
    table.enum('role', ['VS User', 'Vendor', 'Engineer', 'Viewer']).notNullable().alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('compliance_users', (table) => {
    table.enum('role', ['VS User', 'Vendor', 'Engineer']).notNullable().alter();
  });
};
