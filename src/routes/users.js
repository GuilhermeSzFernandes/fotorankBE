const router = require('express').Router();
const { pool } = require('../lib/db');

router.get('/:id/profile', async (req, res) => {
  const { id } = req.params;

  const userRes = await pool.query(
    'SELECT id, name, avatar FROM users WHERE id = $1 AND role = $2',
    [id, 'participant']
  );
  if (!userRes.rows[0])
    return res.status(404).json({ message: 'Participante não encontrado.' });

  const photosRes = await pool.query(
    `SELECT p.id, p.url, p.original_name AS "originalName", p.created_at AS "createdAt",
            COUNT(DISTINCT g.teacher_id)::int AS "gradeCount",
            ROUND(AVG(g.score)::numeric, 1)   AS "avgScore",
            COALESCE(
              json_agg(
                jsonb_build_object('score', g.score, 'comment', g.comment)
                ORDER BY g.created_at ASC
              ) FILTER (WHERE g.id IS NOT NULL),
              '[]'
            ) AS feedbacks
     FROM photos p
     LEFT JOIN grades g ON g.photo_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at ASC`,
    [id]
  );

  res.json({
    user:   userRes.rows[0],
    photos: photosRes.rows.map((r) => ({
      ...r,
      avgScore: r.avgScore !== null ? parseFloat(r.avgScore) : null,
    })),
  });
});

module.exports = router;
