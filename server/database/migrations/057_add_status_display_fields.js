exports.up = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    // Add display status fields to store original user selections
    table.string('vendor_status_display', 50).nullable();
    table.string('engineer_status_display', 50).nullable();
  });

  // Update status enum to include mapped values
  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN status ENUM('New', 'In Progress', 'Pending', 'Completed', 'Raised') 
    DEFAULT 'New'
  `);

  // Update vendor_status and engineer_status enums to include mapped values
  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN vendor_status ENUM('New', 'In Progress', 'Pending', 'Completed', 'Raised') 
    DEFAULT NULL
  `);

  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN engineer_status ENUM('New', 'In Progress', 'Pending', 'Completed', 'Raised') 
    DEFAULT NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.table('tickets', (table) => {
    table.dropColumn('vendor_status_display');
    table.dropColumn('engineer_status_display');
  });

  // Revert status enum to previous values
  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN status ENUM('Open', 'In Progress', 'Resolved', 'Closed', 'Pending', 'Completed', 'Raise', 'In progress', 'Duplicate', 'Ticket by mistake') 
    DEFAULT 'Open'
  `);

  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN vendor_status VARCHAR(50) 
    DEFAULT NULL
  `);

  await knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN engineer_status VARCHAR(50) 
    DEFAULT NULL
  `);
};