const { pool } = require('./db');

async function audit(event, { actorId = null, photoId = null, metadata = {} } = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (event, actor_id, photo_id, metadata)
       VALUES ($1, $2, $3, $4)`,
      [event, actorId ?? null, photoId ?? null, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Log nunca deve quebrar o fluxo principal
    console.error('[audit] falha ao registrar evento:', event, err.message);
  }
}

module.exports = { audit };
