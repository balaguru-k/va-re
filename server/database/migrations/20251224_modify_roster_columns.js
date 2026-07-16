exports.up = async function(knex) {
  await knex.raw('ALTER TABLE rosters DROP FOREIGN KEY rosters_manager_id_foreign');
  await knex.raw('ALTER TABLE rosters DROP FOREIGN KEY rosters_supervisor_id_foreign');
  await knex.raw('ALTER TABLE rosters MODIFY COLUMN manager_id TEXT');
  await knex.raw('ALTER TABLE rosters MODIFY COLUMN supervisor_id TEXT');
};

exports.down = async function(knex) {
  await knex.raw('ALTER TABLE rosters MODIFY COLUMN manager_id INT UNSIGNED');
  await knex.raw('ALTER TABLE rosters MODIFY COLUMN supervisor_id INT UNSIGNED');
  await knex.raw('ALTER TABLE rosters ADD CONSTRAINT rosters_manager_id_foreign FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL');
  await knex.raw('ALTER TABLE rosters ADD CONSTRAINT rosters_supervisor_id_foreign FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL');
};