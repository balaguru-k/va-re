const BaseModel = require('./BaseModel');

class Role extends BaseModel {
  constructor() {
    super('roles');
  }

  async findByName(name) {
    return this.query().where('name', name).first();
  }

  static get ROLES() {
    return {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Admin',
      AUDITOR: 'Auditor',
      SUPERVISOR: 'Supervisor',
      MANAGER: 'Manager',
      LEAD_AUDITOR: 'Lead-Auditor',
      EXECUTIVE: 'Executive',
      HEAD: 'Head',
      LIMELITE_USER: 'Limelite User',
    };
  }
}

module.exports = new Role();