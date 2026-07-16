exports.up = function (knex) {
  return knex.schema.createTable('licam_photos', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().index();
    table.string('file_name', 255).notNullable();       // name field from Licam
    table.string('file_type', 50).nullable();           // type: "image/jpeg"
    table.integer('file_size').nullable();              // size: 3893
    table.string('file_path', 500).notNullable();       // saved file path on server
    table.decimal('lat', 10, 8).nullable();             // lat
    table.decimal('lng', 11, 8).nullable();             // lng
    table.string('place_name', 255).nullable();         // place_name
    table.text('place_address').nullable();             // place_address
    table.string('location', 255).nullable();           // location (sent by Licam)
    table.timestamp('captured_at').nullable();          // captured_at
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('licam_photos');
};
