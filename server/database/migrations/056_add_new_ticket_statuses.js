exports.up = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN status ENUM('Open', 'In Progress', 'Resolved', 'Closed', 'Pending', 'Completed', 'Raise', 'In progress', 'Duplicate', 'Ticket by mistake') 
    DEFAULT 'Open'
  `);
};

exports.down = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE tickets 
    MODIFY COLUMN status ENUM('Open', 'In Progress', 'Resolved', 'Closed') 
    DEFAULT 'Open'
  `);
};
