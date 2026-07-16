exports.up = async function (knex) {
  await knex.schema.createTable('compliance_users', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.enum('role', ['VS User', 'Vendor', 'Engineer']).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('compliance_users');
};
