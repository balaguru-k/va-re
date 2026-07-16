exports.up = function(knex) {
  return knex.schema.createTable('audits', function(table) {
    table.increments('id').primary();
    table.integer('checklist_id').unsigned().notNullable();
    table.integer('auditor_id').unsigned().notNullable();
    table.integer('responsible_person_id').unsigned().nullable();
    table.integer('supervisor_id').unsigned().nullable();
    table.enum('status', ['Assigned', 'In Progress', 'Completed', 'Under Review', 'Closed', 'Objected']).defaultTo('Assigned');
    table.date('audit_date').notNullable();
    table.json('audit_items').nullable();
    table.boolean('has_nc').defaultTo(false);
    table.text('camera_comments').nullable();
    table.text('auditor_remarks').nullable();
    table.text('responsible_remarks').nullable();
    table.text('supervisor_remarks').nullable();
    table.timestamps(true, true);
    
    table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
    table.foreign('auditor_id').references('id').inTable('users').onDelete('RESTRICT');
    table.foreign('responsible_person_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('supervisor_id').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audits');
};