const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../lib/db');
const { getContestConfig, computePhase } = require('../lib/contestPhase');

const PHASE_LABEL = {
  waiting:      'Aguardando início',
  registration: 'Inscrições abertas',
  evaluation:   'Avaliação em andamento',
  closed:       'Concurso encerrado',
};

// Retorna configuração + fase calculada (acesso público)
router.get('/config', async (req, res) => {
  const config = await getContestConfig();
  const phase  = computePhase(config);
  res.json({ config: config ?? {}, phase, phaseLabel: PHASE_LABEL[phase] });
});

// Atualiza datas e configurações (admin)
router.put('/config', auth(['admin']), async (req, res) => {
  const { registration_start, registration_end, evaluation_start, evaluation_end, ranking_public } = req.body;
  const { rows } = await pool.query(
    `UPDATE contest_config
     SET registration_start = $1,
         registration_end   = $2,
         evaluation_start   = $3,
         evaluation_end     = $4,
         ranking_public     = $5,
         updated_at         = NOW()
     WHERE id = 1
     RETURNING *`,
    [
      registration_start || null,
      registration_end   || null,
      evaluation_start   || null,
      evaluation_end     || null,
      ranking_public ?? false,
    ]
  );
  const config = rows[0];
  const phase  = computePhase(config);
  res.json({ config, phase, phaseLabel: PHASE_LABEL[phase] });
});

// Sobrescreve fase manualmente (admin)
router.post('/phase', auth(['admin']), async (req, res) => {
  const { phase } = req.body;
  const valid = ['waiting', 'registration', 'evaluation', 'closed', null];
  if (!valid.includes(phase))
    return res.status(400).json({ message: 'Fase inválida.' });

  const { rows } = await pool.query(
    `UPDATE contest_config SET phase_override = $1, updated_at = NOW() WHERE id = 1 RETURNING *`,
    [phase]
  );
  const config = rows[0];
  const computed = computePhase(config);
  res.json({ config, phase: computed, phaseLabel: PHASE_LABEL[computed] });
});

module.exports = router;
