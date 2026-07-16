exports.up = async function (knex) {
  await knex.schema.alterTable('compliance_users', (table) => {
    table.string('email', 100).nullable();
    table.string('employee_id', 50).nullable();
    table.string('password', 255).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('compliance_users', (table) => {
    table.dropColumn('email');
    table.dropColumn('employee_id');
    table.dropColumn('password');
  });
};
