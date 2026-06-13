const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { getRanking, getRankingByPhoto } = require('../data/queries');
const { getCurrentPhase } = require('../lib/contestPhase');

router.get('/', async (req, res) => {
  const phase = await getCurrentPhase();

  if (phase !== 'closed') {
    const token = req.cookies?.token
      || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) return res.status(403).json({ message: 'O ranking estará disponível ao encerramento do concurso.' });

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!['admin', 'teacher'].includes(payload.role)) {
        return res.status(403).json({ message: 'O ranking estará disponível ao encerramento do concurso.' });
      }
    } catch {
      return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
    }
  }

  const [byPhoto, byParticipant] = await Promise.all([getRankingByPhoto(), getRanking()]);
  res.json({ byPhoto, byParticipant });
});

module.exports = router;
