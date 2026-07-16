exports.up = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.string('subject', 255).nullable();
    table.date('user_assign_date').nullable();
    table.json('assigned_vendors').nullable();
    table.json('assigned_engineers').nullable();
    table.json('raise_attachments').nullable();

  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', (table) => {
    table.dropColumn('subject');
    table.dropColumn('user_assign_date');
    table.dropColumn('assigned_vendors');
    table.dropColumn('assigned_engineers');
    table.dropColumn('raise_attachments');
    table.dropColumn('raise_status');
  });
};
