const BaseModel = require('./BaseModel');

class Location extends BaseModel {
  constructor() {
    super('locations');
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
    let location = await this.findByName(titleCaseName);
    if (!location) {
      location = await this.create({ name: titleCaseName, created_at: new Date(), updated_at: new Date() });
    }
    return location;
  }
async getLocation() {
  return this.query().where('is_active', 1).orderBy('id', 'desc');
}
}

module.exports = new Location();