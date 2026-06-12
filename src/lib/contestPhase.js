const { pool } = require('./db');

async function getContestConfig() {
  const { rows } = await pool.query('SELECT * FROM contest_config WHERE id = 1');
  return rows[0] ?? null;
}

function computePhase(config) {
  if (!config) return 'waiting';
  if (config.phase_override) return config.phase_override;

  const now = new Date();
  const regStart = config.registration_start ? new Date(config.registration_start) : null;
  const regEnd   = config.registration_end   ? new Date(config.registration_end)   : null;
  const evalEnd  = config.evaluation_end     ? new Date(config.evaluation_end)     : null;

  if (!regStart) return 'waiting';
  if (now < regStart) return 'waiting';
  if (!regEnd || now <= regEnd) return 'registration';
  if (!evalEnd || now <= evalEnd) return 'evaluation';
  return 'closed';
}

async function getCurrentPhase() {
  return computePhase(await getContestConfig());
}

module.exports = { getContestConfig, computePhase, getCurrentPhase };
