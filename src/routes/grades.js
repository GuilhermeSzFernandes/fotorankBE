const router = require('express').Router();
const auth = require('../middleware/auth');
const { getPhotosWithGrades, createOrUpdateGrade, deleteGrade, findPhotoById } = require('../data/queries');
const { audit } = require('../lib/audit');
const { getCurrentPhase } = require('../lib/contestPhase');

router.get('/', auth(['teacher', 'admin']), async (req, res) => {
  res.json(await getPhotosWithGrades(req.user.id));
});

router.post('/', auth(['teacher']), async (req, res) => {
  const phase = await getCurrentPhase();
  if (phase !== 'evaluation')
    return res.status(403).json({ message: 'Avaliação só é permitida durante o período de avaliação.' });

  const { photoId, score, comment } = req.body;
  if (!photoId || score === undefined)
    return res.status(400).json({ message: 'photoId e score são obrigatórios.' });
  if (score < 1 || score > 10)
    return res.status(400).json({ message: 'Score deve ser entre 1 e 10.' });

  const photo = await findPhotoById(photoId);
  if (!photo) return res.status(404).json({ message: 'Foto não encontrada.' });
  if (photo.userId === req.user.id)
    return res.status(403).json({ message: 'Você não pode avaliar suas próprias fotos.' });

  const { pool } = require('../lib/db');
  const existing = await pool.query(
    'SELECT id FROM grades WHERE teacher_id = $1 AND photo_id = $2',
    [req.user.id, photoId]
  );
  const grade = await createOrUpdateGrade({ teacherId: req.user.id, photoId, score: Number(score), comment });
  await audit(existing.rowCount > 0 ? 'grade.update' : 'grade.create', {
    actorId: req.user.id,
    photoId,
    metadata: { score: Number(score), comment: comment ?? '' },
  });
  res.status(201).json(grade);
});

router.delete('/:photoId', auth(['teacher']), async (req, res) => {
  const phase = await getCurrentPhase();
  if (phase !== 'evaluation')
    return res.status(403).json({ message: 'Avaliação só é permitida durante o período de avaliação.' });

  const removed = await deleteGrade(req.user.id, req.params.photoId);
  if (!removed) return res.status(404).json({ message: 'Avaliação não encontrada.' });
  await audit('grade.delete', { actorId: req.user.id, photoId: req.params.photoId });
  res.json({ message: 'Avaliação removida.' });
});

module.exports = router;
