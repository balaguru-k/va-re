exports.seed = async function(knex) {
  // Disable foreign key checks temporarily
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  
  await knex('categories').del();
  
  await knex('categories').insert([
    {
      id: 1,
      name: 'Plant/Depo',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      name: 'Bakery',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 3,
      name: 'RMCC',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 4,
      name: 'Farm',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 5,
      name: 'Estate',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 6,
      name: 'Food Outlet',
      required_fields: JSON.stringify(['location', 'name', 'department', 'camera_count', 'checklist']),
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
  
  // Re-enable foreign key checks
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};