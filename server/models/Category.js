const BaseModel = require('./BaseModel');

class Category extends BaseModel {
  constructor() {
    super('categories');
  }

  async findByName(name) {
    return this.query().where('name', name).first();
  }

async getAllWithFields() {
  const categories = await this.query()
    .where('is_active', 1)
    .orderBy('id', 'desc');

  return categories.map(category => ({
    ...category,
    required_fields: category.required_fields
      ? JSON.parse(category.required_fields)
      : []
  }));
}
}

module.exports = new Category();