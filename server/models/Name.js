const knex = require('../config/database');

class Name {
  static toTitleCase(str) {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  static async findAll() {
    return knex('names').select('*').orderBy('name');
  }

  static async findById(id) {
    return knex('names').where('id', id).first();
  }

  static async findOrCreate(name) {
    const titleCaseName = this.toTitleCase(name);
    const existing = await knex('names').where('name', titleCaseName).first();
    if (existing) {
      return existing;
    }
    
    const [id] = await knex('names').insert({ name: titleCaseName });
    return { id, name: titleCaseName };
  }

  static async findOrCreateWithLocation(name, locationId) {
    const titleCaseName = this.toTitleCase(name);
    const existing = await knex('names').where('name', titleCaseName).first();
    if (existing) {
      // Update location_id if it's null and we have a locationId
      if (!existing.location_id && locationId) {
        await knex('names').where('id', existing.id).update({ location_id: locationId });
        existing.location_id = locationId;
      }
      return existing;
    }
    
    const [id] = await knex('names').insert({ name: titleCaseName, location_id: locationId });
    return { id, name: titleCaseName, location_id: locationId };
  }
}

module.exports = Name;