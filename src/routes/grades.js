const router = require('express').Router();
const auth = require('../middleware/auth');
const { getPhotosWithGrades, createOrUpdateGrade, findPhotoById } = require('../data/queries');

router.get('/', auth(['teacher', 'admin']), async (req, res) => {
  res.json(await getPhotosWithGrades(req.user.id));
});

router.post('/', auth(['teacher']), async (req, res) => {
  const { photoId, score, comment } = req.body;
  if (!photoId || score === undefined)
    return res.status(400).json({ message: 'photoId e score são obrigatórios.' });
  if (score < 1 || score > 10)
    return res.status(400).json({ message: 'Score deve ser entre 1 e 10.' });

  const photo = await findPhotoById(photoId);
  if (!photo) return res.status(404).json({ message: 'Foto não encontrada.' });

  const grade = await createOrUpdateGrade({ teacherId: req.user.id, photoId, score: Number(score), comment });
  res.status(201).json(grade);
});

module.exports = router;
