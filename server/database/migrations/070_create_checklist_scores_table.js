exports.up = function (knex) {
  return knex.schema.createTable('checklist_scores', (table) => {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('user_id').unsigned().notNullable();
    table.string('checklist_name', 255).nullable();
    table.string('category_name', 100).nullable();
    table.string('location_name', 100).nullable();
    table.string('department_name', 100).nullable();
    table.integer('yes_count').defaultTo(0);
    table.integer('no_count').defaultTo(0);
    table.integer('yes_score').defaultTo(0);
    table.integer('no_score').defaultTo(0);
    table.date('score_date').notNullable();
    table.timestamps(true, true);

    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['checklist_id', 'user_id', 'score_date']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('checklist_scores');
};
