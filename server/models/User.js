const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');
class User extends BaseModel {
  constructor() {
    super('users');
  }

  async create(userData) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 12);
    }
    userData.created_at = new Date();
    userData.updated_at = new Date();
    return super.create(userData);
  }

  async update(id, userData) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 12);
    }
    userData.updated_at = new Date();
    return super.update(id, userData);
  }

  async findByEmail(email) {
    return this.query().where('email', email).first();
  }

  async findByUsername(username) {
    return this.query().where('username', username).first();
  }

  async findByEmailOrUsername(identifier) {
    return this.query()
      .where('email', identifier)
      .first();
  }

  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async findWithRole(conditions = {}) {
    // Don't join departments - department_id is a JSON array, handle in controller
    const result = await this.query()
      .select('users.*', 'roles.name as role_name', 'locations.name as location_name', 'names.name as facility_name')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('locations', 'users.location_id', 'locations.id')
      .leftJoin('names', 'users.name_id', 'names.id')
      .where(conditions);
    
    if (result.length > 0) {
      // debugLog('Found user with department_id:', result[0].department_id);
    }
    return result;
  }

  async getUsersWithPagination(page = 1, limit = 10, search = '', status = 'active') {
    const offset = (page - 1) * limit;
    // Don't join departments - department_id is a JSON array
    let query = this.query()
      .select('users.id', 'users.username', 'users.email', 'users.employee_id', 
              'users.created_at', 'users.updated_at', 'roles.name as role','users.is_active')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .orderBy('users.created_at', 'desc');

    if (status === 'active') {
      query = query.where('users.is_active', true);
    } else if (status === 'inactive') {
      query = query.where('users.is_active', false);
    }

    if (search) {
      query = query.where(function() {
        this.where('users.username', 'like', `%${search}%`)
            .orWhere('users.email', 'like', `%${search}%`);
      });
    }

    const [data, total] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      query.clone().count('* as count').first()
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

module.exports = new User();