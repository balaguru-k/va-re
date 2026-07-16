exports.up = function(knex) {
  return knex('roles').insert({
    id: 10,
    name: 'Limelite User',
    description: 'Limelite module user access',
    created_at: new Date(),
    updated_at: new Date()
  });
};

exports.down = function(knex) {
  return knex('roles').where('id', 10).del();
};
