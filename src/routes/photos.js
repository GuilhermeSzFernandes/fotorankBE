const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { getPhotosByUser, createPhoto, getAllPhotos } = require('../data/queries');

const USE_S3 = process.env.USE_S3 === 'true';

const fileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens JPEG, PNG ou WebP são aceitas.'));
  }
};

const upload = USE_S3
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter })
  : multer({
      storage: multer.diskStorage({
        destination: path.join(__dirname, '../../uploads'),
        filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter,
    });

router.post('/', auth(['participant']), upload.single('photo'), async (req, res) => {
  if ((await getPhotosByUser(req.user.id)).length >= 3)
    return res.status(400).json({ message: 'Limite de 3 fotos atingido.' });
  if (!req.file)
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });

  let filename, url;
  if (USE_S3) {
    const { uploadToS3 } = require('../lib/s3');
    const result = await uploadToS3(req.file.buffer, req.file.originalname, 'photos');
    filename = result.key;
    url = result.url;
  } else {
    filename = req.file.filename;
    url = `/uploads/${filename}`;
  }

  const photo = await createPhoto({ userId: req.user.id, filename, originalName: req.file.originalname, url });
  res.status(201).json(photo);
});

router.get('/my', auth(['participant']), async (req, res) => {
  res.json(await getPhotosByUser(req.user.id));
});

router.get('/', auth(['teacher', 'admin']), async (req, res) => {
  res.json(await getAllPhotos());
});

module.exports = router;
