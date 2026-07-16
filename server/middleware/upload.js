const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('../config/logger');

// Use memory storage for processing before saving
const imageStorage = multer.memoryStorage();

const imageUpload = multer({ 
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Camera file upload configuration (supports images, PDF, Excel)
const cameraFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/camera-files';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const cameraFileUpload = multer({
  storage: cameraFileStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDF, and Excel files are allowed'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

// Middleware to compress images after multer processes them
const compressImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const uploadDir = 'uploads/images';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    const processedFiles = [];
    
    for (const file of req.files) {
      if (file.mimetype.startsWith('image/')) {
        // Use Base64 encoding to preserve ALL characters including #, $, spaces, etc.
        const originalName = file.originalname.trim();
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        
        // Encode filename to Base64 (URL-safe)
        const encodedName = Buffer.from(baseName).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, ''); // Remove padding
        
        // Create filename: timestamp-base64encoded.jpg
        const filename = `${Date.now()}-${encodedName}.jpg`;
        const filepath = path.join(uploadDir, filename);
        
        // Compress and resize image
        await sharp(file.buffer)
          .resize(1024, 1024, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ 
            quality: 70,
            progressive: true 
          })
          .toFile(filepath);
        
        // Update file object with new path and filename
        file.filename = filename;
        file.path = filepath;
        processedFiles.push(file);
      } else {
        processedFiles.push(file);
      }
    }
    
    req.files = processedFiles;
    next();
  } catch (error) {
    logger.error('Image compression error:', error);
    next(error);
  }
};

// Combined middleware for handling both images and camera files
const combinedUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      // Handle image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for images field'));
      }
    } else if (file.fieldname === 'cameraFile') {
      // Handle camera files (images, PDF, Excel)
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (allowedTypes.includes(file.mimetype) || 
          file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|xls|xlsx)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only images, PDF, and Excel files are allowed for camera file'));
      }
    } else {
      cb(new Error('Unexpected field'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
}).fields([
  { name: 'images', maxCount: 200 },
  { name: 'cameraFile', maxCount: 1 }
]);

// Process uploaded files after multer
const processUploads = async (req, res, next) => {
  try {
    // Process images (compress and save)
    if (req.files && req.files.images) {
      const imageUploadDir = 'uploads/images';
      if (!fs.existsSync(imageUploadDir)) {
        fs.mkdirSync(imageUploadDir, { recursive: true });
      }

      const processedImages = [];
      for (const file of req.files.images) {
        // Use Base64 encoding to preserve ALL characters
        const originalName = file.originalname.trim();
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        
        // Encode filename to Base64 (URL-safe)
        const encodedName = Buffer.from(baseName).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, ''); // Remove padding
        
        // Create filename: timestamp-base64encoded.jpg
        const filename = `${Date.now()}-${encodedName}.jpg`;
        const filepath = path.join(imageUploadDir, filename);
        
        await sharp(file.buffer)
          .resize(1024, 1024, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ 
            quality: 70,
            progressive: true 
          })
          .toFile(filepath);
        
        file.filename = filename;
        file.path = filepath;
        processedImages.push(file);
      }
      req.files.images = processedImages;
    }

    // Process camera file (save to camera-files directory)
    if (req.files && req.files.cameraFile && req.files.cameraFile[0]) {
      const cameraUploadDir = 'uploads/camera-files';
      if (!fs.existsSync(cameraUploadDir)) {
        fs.mkdirSync(cameraUploadDir, { recursive: true });
      }

      const cameraFile = req.files.cameraFile[0];
      const filename = Date.now() + '-' + cameraFile.originalname;
      const filepath = path.join(cameraUploadDir, filename);
      
      fs.writeFileSync(filepath, cameraFile.buffer);
      
      cameraFile.filename = filename;
      cameraFile.path = filepath;
      req.file = cameraFile; // Set as single file for backward compatibility
    }

    next();
  } catch (error) {
    logger.error('File processing error:', error);
    next(error);
  }
};

module.exports = { imageUpload, compressImages, cameraFileUpload, combinedUpload, processUploads };
