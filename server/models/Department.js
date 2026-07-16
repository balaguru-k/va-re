const BaseModel = require('./BaseModel');

class Department extends BaseModel {
  constructor() {
    super('departments');
  }

  async findByName(name) {
    return this.query().where('name', name).first();
  }

  toTitleCase(str) {
    return str.toLowerCase().split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  async findOrCreate(name) {
    const titleCaseName = this.toTitleCase(name);
    let department = await this.findByName(titleCaseName);
    if (!department) {
      department = await this.create({ name: titleCaseName, created_at: new Date(), updated_at: new Date() });
    }
    return department;
  }

  async findOrCreateWithLocation(name, locationId) {
    const titleCaseName = this.toTitleCase(name);
    let department = await this.findByName(titleCaseName);
    if (department) {
      // Always update location_id if provided and different
      if (locationId && department.location_id !== locationId) {
        await this.update(department.id, { location_id: locationId });
        department.location_id = locationId;
      }
      return department;
    }
    
    department = await this.create({ 
      name: titleCaseName, 
      location_id: locationId,
      created_at: new Date(), 
      updated_at: new Date() 
    });
    return department;
  }
}

module.exports = new Department();