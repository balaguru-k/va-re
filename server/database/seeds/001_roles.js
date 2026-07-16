exports.seed = async function (knex) {
  // Disable foreign key checks temporarily
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  await knex('roles').del();

  await knex('roles').insert([
    {
      id: 1,
      name: 'Super Admin',
      description: 'Full system access and user management',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      name: 'Auditor',
      description: 'Audit and review capabilities',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 3,
      name: 'Supervisor',
      description: 'Supervisory access and oversight',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 4,
      name: 'Manager',
      description: 'Review and assessment capabilities',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 5,
      name: 'Lead-Auditor',
      description: 'Lead auditor with admin management access',
      created_at: new Date(),
      updated_at: new Date()
    },

    {
      id: 6,
      name: 'Executive',
      description: 'Executive-level access and oversight',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 7,
      name: 'Admin',
      description: 'Administrative access',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 8,
      name: 'Head',
      description: 'Head-level access with location-based reporting',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 10,
      name: 'Limelite User',
      description: 'Limelite module user access',
      created_at: new Date(),
      updated_at: new Date()
    },
  ]);

  // Re-enable foreign key checks
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};