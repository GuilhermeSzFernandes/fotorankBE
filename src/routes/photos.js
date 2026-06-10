const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { getPhotosByUser, createPhoto, photos } = require('../data/mock');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens JPEG, PNG ou WebP são aceitas.'));
    }
  },
});

router.post('/', auth(['participant']), upload.single('photo'), (req, res) => {
  const existing = getPhotosByUser(req.user.id);
  if (existing.length >= 3) {
    return res.status(400).json({ message: 'Limite de 3 fotos atingido.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const photo = createPhoto({
    userId: req.user.id,
    filename: req.file.filename,
    originalName: req.file.originalname,
  });

  res.status(201).json(photo);
});

router.get('/my', auth(['participant']), (req, res) => {
  res.json(getPhotosByUser(req.user.id));
});

router.get('/', auth(['teacher', 'admin']), (req, res) => {
  res.json(photos);
});

module.exports = router;
