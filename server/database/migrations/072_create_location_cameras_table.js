exports.up = function(knex) {
  return knex.schema.createTable('location_cameras', (table) => {
    table.increments('id').primary();
    table.string('location', 100).notNullable();
    table.string('nvr', 100).notNullable();
    table.integer('camera_no').notNullable();
    table.string('camera_name', 255).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['location', 'nvr']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('location_cameras');
};
