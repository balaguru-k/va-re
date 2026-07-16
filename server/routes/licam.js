const express = require('express');
const router = express.Router();
const { uploadPhoto, getPhotos } = require('../controllers/licamController');

router.post('/photos', uploadPhoto);
router.get('/photos', getPhotos);

module.exports = router;
