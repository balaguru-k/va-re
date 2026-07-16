exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('username', 50).notNullable().unique();
    table.string('email', 100).notNullable().unique();
    table.string('full_name', 100).notNullable();
    table.string('password', 255).notNullable();
    table.integer('role_id').unsigned().notNullable();
    table.string('employee_id').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login').nullable();
    table.timestamps(true, true);
    
    table.foreign('role_id').references('id').inTable('roles').onDelete('RESTRICT');
    table.index(['email']);
    table.index(['username']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};