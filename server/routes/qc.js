const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

const uploadDir = path.join(__dirname, '../uploads/qc-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const qcImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const compressQcImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  try {
    const processedFiles = [];
    for (const file of req.files) {
      if (file.mimetype.startsWith('image/')) {
        const originalName = file.originalname.trim();
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);

        const encodedName = Buffer.from(baseName).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');

        const filename = `${Date.now()}-${encodedName}.jpg`;
        const filepath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70, progressive: true })
          .toFile(filepath);

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
    logger.error('QC image compression error:', error);
    next(error);
  }
};

router.use(authenticateToken);

// Lead-Auditor routes
router.post('/submit', requireRole(['Lead-Auditor']), qcImageUpload.array('images', 50), compressQcImages, qcController.submitQcFormWithImages);
router.get('/submissions', requireRole(['Lead-Auditor']), qcController.getQcSubmissions);
router.get('/submissions/:id', requireRole(['Lead-Auditor', 'Auditor']), qcController.getQcSubmissionDetail);
router.get('/submissions/:id/edit', requireRole(['Lead-Auditor']), qcController.getQcSubmissionEditData);
router.put('/submissions/:id', requireRole(['Lead-Auditor']), qcController.updateQcSubmission);

router.get('/export', requireRole(['Lead-Auditor', 'Super Admin']), qcController.exportQcSubmissions);

// Auditor routes
router.get('/auditor/submissions', requireRole(['Auditor']), qcController.getAuditorQcSubmissions);
router.post('/auditor/submissions/:id/remark', requireRole(['Auditor']), qcController.submitAuditorQcRemark);

module.exports = router;
