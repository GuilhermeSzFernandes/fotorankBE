const router = require('express').Router();
const auth = require('../middleware/auth');
const { grades, photos, createOrUpdateGrade, findUserById } = require('../data/mock');

router.get('/', auth(['teacher', 'admin']), (req, res) => {
  const result = photos.map((photo) => {
    const owner = findUserById(photo.userId);
    const myGrade = grades.find(
      (g) => g.photoId === photo.id && g.teacherId === req.user.id
    );
    return {
      ...photo,
      ownerName: owner ? owner.name : 'Desconhecido',
      ownerAvatar: owner ? owner.avatar : null,
      myGrade: myGrade || null,
    };
  });
  res.json(result);
});

router.post('/', auth(['teacher']), (req, res) => {
  const { photoId, score, comment } = req.body;
  if (!photoId || score === undefined)
    return res.status(400).json({ message: 'photoId e score são obrigatórios.' });
  if (score < 1 || score > 10)
    return res.status(400).json({ message: 'Score deve ser entre 1 e 10.' });

  const photo = photos.find((p) => p.id === photoId);
  if (!photo) return res.status(404).json({ message: 'Foto não encontrada.' });

  const grade = createOrUpdateGrade({
    teacherId: req.user.id,
    photoId,
    score: Number(score),
    comment,
  });
  res.status(201).json(grade);
});

module.exports = router;
