exports.up = async function(knex) {
  await knex.raw('ALTER TABLE rosters DROP COLUMN supervisor_ids');
  await knex.raw('ALTER TABLE rosters DROP COLUMN manager_ids');
};

exports.down = async function(knex) {
  await knex.raw('ALTER TABLE rosters ADD COLUMN supervisor_ids TEXT');
  await knex.raw('ALTER TABLE rosters ADD COLUMN manager_ids TEXT');
};