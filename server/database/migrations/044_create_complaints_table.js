exports.up = function(knex) {
  return knex.schema.createTable('complaints', function(table) {
    table.increments('id').primary();
    table.string('ticket_no').unique().nullable();
    table.integer('user_id').unsigned().notNullable();
    table.integer('location_id').unsigned().notNullable();
    table.integer('department_id').unsigned().nullable();
    table.text('issue').notNullable(); // Store as comma-separated or JSON
    table.text('remarks').nullable();
    table.string('attachment').nullable();
    table.string('status').defaultTo('Pending');
    table.integer('completed_by').unsigned().nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('location_id').references('id').inTable('locations').onDelete('CASCADE');
    table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
    table.foreign('completed_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('complaints');
};
