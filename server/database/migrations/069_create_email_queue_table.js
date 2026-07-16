exports.up = function (knex) {
  return knex.schema.createTable('email_queue', (table) => {
    table.increments('id').primary();
    table.string('checklist_name', 255).nullable();
    table.string('category_name', 100).nullable();
    table.string('location_name', 100).nullable();
    table.string('department_name', 100).nullable();
    table.string('to', 500).notNullable();
    table.string('cc', 500).nullable();
    table.string('subject', 500).notNullable();
    table.text('html').nullable();
    table.text('text').nullable();
    table.json('attachments').nullable();
    table.enum('status', ['pending', 'processing', 'sent', 'failed']).defaultTo('pending').index();
    table.integer('attempts').defaultTo(0);
    table.integer('max_attempts').defaultTo(3);
    table.text('last_error').nullable();
    table.timestamp('scheduled_at').defaultTo(knex.fn.now());
    table.timestamp('sent_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('email_queue');
};
