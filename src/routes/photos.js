const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { getPhotosByUser, createPhoto, getAllPhotos, deletePhoto, findPhotoById } = require('../data/queries');

const USE_S3 = process.env.USE_S3 === 'true';

const fileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens JPEG, PNG ou WebP são aceitas.'));
  }
};

const upload = USE_S3
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter })
  : multer({
      storage: multer.diskStorage({
        destination: path.join(__dirname, '../../uploads'),
        filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
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

router.delete('/:id', auth(['participant']), async (req, res) => {
  const existing = await findPhotoById(req.params.id);
  if (!existing || existing.userId !== req.user.id)
    return res.status(404).json({ message: 'Foto não encontrada.' });

  const { pool } = require('../lib/db');
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM grades WHERE photo_id = $1', [req.params.id]);
  if (rows[0].n > 0)
    return res.status(403).json({ message: 'Esta foto já foi avaliada e não pode ser removida.' });

  const photo = await deletePhoto(req.params.id, req.user.id);

  if (USE_S3) {
    const { deleteFromS3 } = require('../lib/s3');
    await deleteFromS3(photo.filename).catch(() => {});
  } else {
    const fs = require('fs');
    const filePath = require('path').join(__dirname, '../../uploads', photo.filename);
    fs.unlink(filePath, () => {});
  }

  res.json({ message: 'Foto removida.' });
});

router.get('/', auth(['teacher', 'admin']), async (req, res) => {
  res.json(await getAllPhotos());
});

module.exports = router;
