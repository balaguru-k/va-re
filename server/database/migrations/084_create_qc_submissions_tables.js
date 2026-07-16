exports.up = function (knex) {
  return knex.schema
    .createTable('qc_submissions', (table) => {
      table.increments('id').primary();
      table.integer('checklist_id').unsigned().notNullable();
      table.integer('template_checklist_id').unsigned().nullable();
      table.date('video_date').notNullable();
      table.integer('auditor_id').unsigned().nullable();
      table.string('emp_id', 50).nullable();
      table.string('auditor_name', 100).nullable();
      table.string('checklist_name', 255).nullable();
      table.string('location', 100).nullable();
      table.integer('camera_audited').nullable();
      table.integer('nc_count').defaultTo(0);
      table.integer('nc_qc_count').nullable();
      table.integer('submitted_by').unsigned().notNullable();
      table.string('submitted_by_name', 100).nullable();
      table.timestamps(true, true);

      table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
      table.foreign('submitted_by').references('id').inTable('users').onDelete('CASCADE');
      table.index(['video_date']);
      table.index(['checklist_id']);
      table.index(['auditor_id']);
      table.index(['submitted_by']);
      table.index(['template_checklist_id']);
    })
    .createTable('qc_submission_items', (table) => {
      table.increments('id').primary();
      table.integer('qc_submission_id').unsigned().notNullable();
      table.integer('checklist_item_id').unsigned().nullable();
      table.integer('checklist_data_id').unsigned().nullable();
      table.string('qc_update', 50).nullable();
      table.text('remark').nullable();
      table.json('images').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('qc_submission_id').references('id').inTable('qc_submissions').onDelete('CASCADE');
      table.index(['qc_submission_id']);
      table.index(['qc_update']);
      table.index(['checklist_item_id']);
      table.index(['checklist_data_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('qc_submission_items')
    .dropTableIfExists('qc_submissions');
};
