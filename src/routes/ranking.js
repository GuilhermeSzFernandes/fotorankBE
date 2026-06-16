const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { getRanking, getRankingByPhoto, getPhotoGrades } = require('../data/queries');
const { getContestConfig, computePhase } = require('../lib/contestPhase');

async function checkRankingAccess(req, res, restrictedMsg) {
  const config = await getContestConfig();
  const phase = computePhase(config);
  const rankingPublic = config?.ranking_public ?? false;

  if (rankingPublic || phase === 'closed') return true;

  const token = req.cookies?.token
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) { res.status(403).json({ message: restrictedMsg }); return false; }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!['admin', 'teacher'].includes(payload.role)) {
      res.status(403).json({ message: restrictedMsg });
      return false;
    }
  } catch {
    res.status(401).json({ message: 'Sessão inválida ou expirada.' });
    return false;
  }

  return true;
}

router.get('/', async (req, res) => {
  const allowed = await checkRankingAccess(req, res, 'O ranking estará disponível ao encerramento do concurso.');
  if (!allowed) return;

  const byPhoto = await getRankingByPhoto();
  res.json({ byPhoto });
});

router.get('/photo/:id/grades', async (req, res) => {
  const allowed = await checkRankingAccess(req, res, 'Disponível apenas após o encerramento do concurso.');
  if (!allowed) return;

  const grades = await getPhotoGrades(req.params.id);
  res.json(grades);
});

module.exports = router;
