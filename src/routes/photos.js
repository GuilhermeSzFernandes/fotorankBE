const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { getPhotosByUser, createPhoto, getAllPhotos, deletePhoto, findPhotoById } = require('../data/queries');
const { audit } = require('../lib/audit');
const { getCurrentPhase } = require('../lib/contestPhase');

const USE_S3 = process.env.USE_S3 === 'true';

const fileFilter = (req, file, cb) => {
  if (/jpe?g|png/.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens JPG ou PNG são aceitas.'));
  }
};

const { imageSize } = require('image-size');

const MAX_BYTES = 30 * 1024 * 1024;
const MIN_W = 800;
const MIN_H = 600;

const cleanText = (value, max) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const upload = USE_S3
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES }, fileFilter })
  : multer({
      storage: multer.diskStorage({
        destination: path.join(__dirname, '../../uploads'),
        filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: MAX_BYTES },
      fileFilter,
    });

router.post('/', auth(['participant']), upload.single('photo'), async (req, res) => {
  const phase = await getCurrentPhase();
  if (phase !== 'registration')
    return res.status(403).json({ message: 'Envio de fotos só é permitido durante o período de inscrição.' });

  if ((await getPhotosByUser(req.user.id)).length >= 3)
    return res.status(400).json({ message: 'Limite de 3 fotos atingido.' });
  if (!req.file)
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });

  try {
    const source = USE_S3 ? req.file.buffer : require('fs').readFileSync(req.file.path);
    const { width, height } = imageSize(source);
    if (width < MIN_W || height < MIN_H) {
      if (!USE_S3) require('fs').unlink(req.file.path, () => {});
      return res.status(400).json({
        message: `Resolução mínima é ${MIN_W}×${MIN_H} px. Sua foto tem ${width}×${height} px.`,
      });
    }
  } catch {
    if (!USE_S3 && req.file?.path) require('fs').unlink(req.file.path, () => {});
    return res.status(400).json({ message: 'Não foi possível ler as dimensões da imagem.' });
  }

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

  const location    = cleanText(req.body.location, 120);
  const equipment   = cleanText(req.body.equipment, 120);
  const description = cleanText(req.body.description, 500);

  const photo = await createPhoto({ userId: req.user.id, filename, originalName: req.file.originalname, url, location, equipment, description });
  await audit('photo.upload', { actorId: req.user.id, photoId: photo.id, metadata: { originalName: req.file.originalname, url } });
  res.status(201).json(photo);
});

router.get('/my', auth(['participant']), async (req, res) => {
  res.json(await getPhotosByUser(req.user.id));
});

router.delete('/:id', auth(['participant']), async (req, res) => {
  const phase = await getCurrentPhase();
  if (phase !== 'registration')
    return res.status(403).json({ message: 'Remoção de fotos só é permitida durante o período de inscrição.' });

  const existing = await findPhotoById(req.params.id);
  if (!existing || existing.userId !== req.user.id)
    return res.status(404).json({ message: 'Foto não encontrada.' });

  const photo = await deletePhoto(req.params.id, req.user.id);

  if (USE_S3) {
    const { deleteFromS3 } = require('../lib/s3');
    await deleteFromS3(photo.filename).catch(() => {});
  } else {
    const fs = require('fs');
    const filePath = require('path').join(__dirname, '../../uploads', photo.filename);
    fs.unlink(filePath, () => {});
  }

  await audit('photo.delete', { actorId: req.user.id, photoId: photo.id, metadata: { originalName: photo.originalName } });
  res.json({ message: 'Foto removida.' });
});

// Somente admin: a lista traz o userId do autor, que permitiria ao professor
// descobrir o nome via /api/users/:id/profile (quebrando a avaliação cega).
router.get('/', auth(['admin']), async (req, res) => {
  res.json(await getAllPhotos());
});

module.exports = router;
