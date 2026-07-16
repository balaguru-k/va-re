exports.up = async function (knex) {
  await knex.raw(`
    INSERT IGNORE INTO roles (id, name, description, created_at, updated_at)
    VALUES (8, 'Compliance Admin', 'Compliance admin with ticket management and masters access', NOW(), NOW())
  `);
};

exports.down = async function (knex) {
  await knex('roles').where('id', 8).del();
};
