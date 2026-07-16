exports.up = function(knex) {
  return knex.schema
    .createTable('rotation_options', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable(); // e.g. "Option A", "Option B"
      table.text('description').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('rotation_checklists', function(table) {
      table.increments('id').primary();
      table.integer('option_id').unsigned().notNullable();
      table.integer('checklist_id').unsigned().notNullable();
      table.integer('auditor_id').unsigned().nullable();
      table.timestamps(true, true);

      table.foreign('option_id').references('id').inTable('rotation_options').onDelete('CASCADE');
      table.foreign('checklist_id').references('id').inTable('checklists').onDelete('CASCADE');
      table.foreign('auditor_id').references('id').inTable('users').onDelete('SET NULL');
      table.unique(['option_id', 'checklist_id']);
    })
    .createTable('rotation_active_log', function(table) {
      table.increments('id').primary();
      table.integer('option_id').unsigned().notNullable();
      table.date('activated_date').notNullable();
      table.integer('activated_by').unsigned().notNullable();
      table.timestamps(true, true);

      table.foreign('option_id').references('id').inTable('rotation_options').onDelete('CASCADE');
      table.foreign('activated_by').references('id').inTable('users').onDelete('CASCADE');
    })
    .createTable('rotation_temp_swaps', function(table) {
      table.increments('id').primary();
      table.integer('rotation_checklist_id').unsigned().notNullable();
      table.integer('original_auditor_id').unsigned().nullable();
      table.integer('temp_auditor_id').unsigned().notNullable();
      table.date('swap_date').notNullable();
      table.integer('swapped_by').unsigned().notNullable();
      table.timestamps(true, true);

      table.foreign('rotation_checklist_id').references('id').inTable('rotation_checklists').onDelete('CASCADE');
      table.foreign('original_auditor_id').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('temp_auditor_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('swapped_by').references('id').inTable('users').onDelete('CASCADE');
      table.unique(['rotation_checklist_id', 'swap_date']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('rotation_temp_swaps')
    .dropTableIfExists('rotation_active_log')
    .dropTableIfExists('rotation_checklists')
    .dropTableIfExists('rotation_options');
};
