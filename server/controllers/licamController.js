const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const LicamPhoto = require('../models/LicamPhoto');

const UPLOAD_DIR = path.join(__dirname, '../uploads/licam');

const ensureDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

// POST /api/licam/photos
// Accepts exact Licam payload: { name, type, size, preview, lat, lng, place_name, place_address, location, captured_at, device_id }
const uploadPhoto = async (req, res) => {
  try {
    console.log('Licam POST /photos - Content-Type:', req.headers['content-type']);
    console.log('Licam POST /photos - body keys:', Object.keys(req.body || {}));
    console.log('Licam POST /photos - device_id:', req.body?.device_id, 'preview length:', req.body?.preview?.length || 0);
    const { device_id, preview, name, type, size, lat, lng, place_name, place_address, location, captured_at } = req.body;

    if (!device_id || !preview) {
      return res.status(400).json({ error: 'device_id and preview are required', received_keys: Object.keys(req.body || {}) });
    }

    ensureDir();

    // Reuse same compression logic as upload.js (sharp)
    const base64Data = preview.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeDeviceId = device_id.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${Date.now()}_${safeDeviceId}.jpg`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, progressive: true })
      .toFile(filepath);

    const photo = await LicamPhoto.create({
      device_id,
      file_name: name || filename,
      file_type: type || 'image/jpeg',
      file_size: size || null,
      file_path: `uploads/licam/${filename}`,
      lat: lat || null,
      lng: lng || null,
      place_name: place_name || location || null,
      place_address: place_address || null,
      location: location || null,
      captured_at: captured_at ? new Date(captured_at) : new Date(),
    });

    res.status(201).json({ success: true, photo });
  } catch (error) {
    console.error('Licam upload error:', error);
    res.status(500).json({ error: 'Failed to save photo', details: error.message });
  }
};

// GET /api/licam/photos?device_id=xxx&location=xxx
const getPhotos = async (req, res) => {
  try {
    const { device_id, location } = req.query;

    if (!device_id || !location) {
      return res.status(400).json({ error: 'device_id and location are required' });
    }

    const photos = await LicamPhoto.findByDeviceId(device_id, location);

    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const result = photos.map((p) => ({
      ...p,
      // url: `${baseUrl}/${p.file_path}`,
      url: `${baseUrl}/${p.file_path}`.replace(/^http:/, 'https:'),
    }));

    res.json({ success: true, photos: result });
  } catch (error) {
    console.error('Licam gallery error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
};

module.exports = { uploadPhoto, getPhotos };
