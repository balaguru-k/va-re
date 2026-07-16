exports.up = function(knex) {
  return Promise.all([
    // Remove responsible_person_id from daily_checklist_instances if it exists
    knex.schema.hasColumn('daily_checklist_instances', 'responsible_person_id').then(exists => {
      if (exists) {
        return knex.schema.alterTable('daily_checklist_instances', table => {
          table.dropColumn('responsible_person_id');
        });
      }
    }),
    
    // Remove responsible_person_id from rosters if it exists
    knex.schema.hasColumn('rosters', 'responsible_person_id').then(exists => {
      if (exists) {
        return knex.schema.alterTable('rosters', table => {
          table.dropColumn('responsible_person_id');
        });
      }
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    // Add back responsible_person_id to daily_checklist_instances
    knex.schema.alterTable('daily_checklist_instances', table => {
      table.integer('responsible_person_id').unsigned().nullable();
      table.foreign('responsible_person_id').references('id').inTable('users');
    }),
    
    // Add back responsible_person_id to rosters
    knex.schema.alterTable('rosters', table => {
      table.integer('responsible_person_id').unsigned().nullable();
      table.foreign('responsible_person_id').references('id').inTable('users');
    })
  ]);
};