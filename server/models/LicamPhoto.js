const BaseModel = require('./BaseModel');

class LicamPhoto extends BaseModel {
  constructor() {
    super('licam_photos');
  }

async findByDeviceId(device_id, location) {
    return this.query().where({ device_id, location }).orderBy('captured_at', 'desc');
  }
}

module.exports = new LicamPhoto();
