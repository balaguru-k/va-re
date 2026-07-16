exports.up = function(knex) {
  return knex.schema.createTable('checklists', function(table) {
    table.increments('id').primary();
    table.integer('category_id').unsigned().notNullable();
    table.integer('location_id').unsigned().nullable();
    table.integer('department_id').unsigned().nullable();
    table.string('name', 100).notNullable();
    table.integer('camera_count').defaultTo(0);
    table.string('checklist_name', 100).notNullable();
    table.enum('frequency', ['Daily', 'Weekly', 'Monthly']).notNullable();
    table.integer('audit_count').notNullable();
    table.time('alert_time').notNullable();
    table.string('checklist_file').nullable();
    table.json('checklist_items').nullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('total_camera_audited').nullable();
    table.integer('total_camera_random_audited').nullable();
    table.integer('total_camera_not_audited').nullable();
    table.integer('total_camera_offline').nullable();
    table.decimal('total_camera_offline_percent', 5, 2).nullable();
    table.integer('total_camera_technical_issues').nullable();
    table.decimal('total_camera_technical_issues_percent', 5, 2).nullable();
    table.integer('total_ncs').nullable();
    table.string('camera_file').nullable();
    table.text('remark').nullable();
    table.string('status').nullable();
    table.integer('time_taken_seconds').nullable();
    table.integer('created_by').unsigned().nullable();
    table.integer('updated_by').unsigned().nullable();
    table.timestamps(true, true);
    
    table.foreign('category_id').references('id').inTable('categories').onDelete('RESTRICT');
    table.foreign('location_id').references('id').inTable('locations').onDelete('RESTRICT');
    table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('checklists');
};