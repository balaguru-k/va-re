const db = require('../config/database');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  query() {
    return this.db(this.tableName);
  }

  async findAll(conditions = {}) {
    return this.query().where(conditions);
  }

  async findById(id) {
    return this.query().where('id', id).first();
  }

  async create(data) {
    try {
      const [id] = await this.query().insert(data);
      return this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  async update(id, data) {
    await this.query().where('id', id).update(data);
    return this.findById(id);
  }

  async delete(id) {
    return this.query().where('id', id).update({ deleted_at: new Date() });
  }

  async forceDelete(id) {
    return this.query().where('id', id).del();
  }

  async restore(id) {
    return this.query().where('id', id).update({ deleted_at: null });
  }

  // Soft delete query methods
  queryActive() {
    return this.db(this.tableName).whereNull('deleted_at');
  }

  queryWithDeleted() {
    return this.db(this.tableName);
  }

  queryOnlyDeleted() {
    return this.db(this.tableName).whereNotNull('deleted_at');
  }

  async paginate(page = 1, limit = 10, conditions = {}) {
    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.query().where(conditions).limit(limit).offset(offset),
      this.query().where(conditions).count('* as count').first()
    ]);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    };
  }
}

module.exports = BaseModel;