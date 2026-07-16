exports.up = async function (knex) {
  await knex.schema.alterTable('tickets', (table) => {
    table.enum('offline', ['Internet', 'Power']).nullable().defaultTo(null);
    table.enum('device', ['Hardware', 'Software']).nullable().defaultTo(null);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tickets', (table) => {
    table.dropColumn('offline');
    table.dropColumn('device');
  });
};
