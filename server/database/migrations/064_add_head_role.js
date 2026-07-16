exports.up = function(knex) {
  return knex('roles').insert({
    id: 8,
    name: 'Head',
    description: 'Head-level access with location-based reporting',
    created_at: new Date(),
    updated_at: new Date()
  });
};

exports.down = function(knex) {
  return knex('roles').where('id', 8).del();
};
