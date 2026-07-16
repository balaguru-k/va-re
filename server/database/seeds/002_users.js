const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Disable foreign key checks temporarily
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  
  await knex('users').del();
  
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  await knex('users').insert([
    {
      id: 1,
      username: 'superadmin',
      email: 'admin@varewamp.com',
      password: hashedPassword,
      role_id: 1,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
  
  // Re-enable foreign key checks
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};