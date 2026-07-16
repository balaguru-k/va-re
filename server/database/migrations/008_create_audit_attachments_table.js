exports.up = function(knex) {
  return knex.schema.createTable('audit_attachments', function(table) {
    table.increments('id').primary();
    table.integer('audit_id').unsigned().notNullable();
    table.string('file_name', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.string('file_type', 50).notNullable();
    table.enum('attachment_type', ['auditor', 'responsible', 'supervisor']).notNullable();
    table.timestamps(true, true);
    
    table.foreign('audit_id').references('id').inTable('audits').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_attachments');
};