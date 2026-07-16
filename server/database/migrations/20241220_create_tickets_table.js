exports.up = function(knex) {
  return knex.schema.hasTable('tickets').then(exists => {
    if (exists) return;
    return knex.schema.createTable('tickets', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.foreign('user_id').references('id').inTable('users').onUpdate('CASCADE').onDelete('CASCADE');
      table.string('issue', 100).notNullable();
      table.text('remarks').nullable();
      table.json('attachments').nullable();
      table.enum('status', ['Open', 'In Progress', 'Resolved', 'Closed']).defaultTo('Open').notNullable();
      table.enum('priority', ['Low', 'Medium', 'High', 'Critical']).defaultTo('Medium').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['user_id']);
      table.index(['status']);
      table.index(['created_at']);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tickets');
};
