exports.up = async function(knex) {
  const tables = ['users', 'checklists', 'rosters', 'checklist_data', 'checklist_assignments'];
  
  for (const table of tables) {
    await knex.schema.alterTable(table, function(t) {
      t.timestamp('deleted_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  const tables = ['users', 'checklists', 'rosters', 'checklist_data', 'checklist_assignments'];
  
  for (const table of tables) {
    await knex.schema.alterTable(table, function(t) {
      t.dropColumn('deleted_at');
    });
  }
};