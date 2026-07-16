exports.up = async function (knex) {
  await knex.schema.createTable('compliance_departments', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('code', 20).nullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamp('deleted_at').nullable().defaultTo(null);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('compliance_departments');
};