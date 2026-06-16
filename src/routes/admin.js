const router = require('express').Router();
const auth = require('../middleware/auth');
const { getAllUsers, createUser, deleteUser, findUserByEmail, findUserById, updateUserRole, getMetrics, getPhotoGrades } = require('../data/queries');
const { audit } = require('../lib/audit');

router.get('/metrics', auth(['admin']), async (req, res) => {
  res.json(await getMetrics());
});

router.get('/users', auth(['admin']), async (req, res) => {
  const users = await getAllUsers();
  res.json(users.map(({ password, ...u }) => u));
});

router.get('/photos', auth(['admin']), async (req, res) => {
  const { pool } = require('../lib/db');
  const { rows } = await pool.query(
    `SELECT p.id, p.original_name AS "originalName", p.url, p.created_at AS "createdAt",
            u.name AS "ownerName", u.id AS "ownerId",
            COUNT(DISTINCT g.teacher_id)::int   AS "gradeCount",
            ROUND(AVG(g.score)::numeric, 1)     AS "avgScore"
     FROM photos p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN grades g ON g.photo_id = p.id
     GROUP BY p.id, u.name, u.id
     ORDER BY p.created_at DESC`
  );
  res.json(rows.map((r) => ({ ...r, avgScore: r.avgScore !== null ? parseFloat(r.avgScore) : null })));
});

router.get('/photos/:id/grades', auth(['admin']), async (req, res) => {
  const grades = await getPhotoGrades(req.params.id);
  res.json(grades);
});

router.get('/teachers', auth(['admin']), async (req, res) => {
  const users = await getAllUsers();
  res.json(users.filter((u) => u.role === 'teacher').map(({ password, ...u }) => u));
});

router.post('/teachers', auth(['admin']), async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Preencha todos os campos.' });
  if (await findUserByEmail(email))
    return res.status(409).json({ message: 'E-mail já cadastrado.' });

  const user = await createUser({ name, email, password, role: 'teacher' });
  const { password: _, ...safe } = user;
  res.status(201).json(safe);
});

router.patch('/users/:id/role', auth(['admin']), async (req, res) => {
  const { role } = req.body;
  if (!['participant', 'teacher'].includes(role))
    return res.status(400).json({ message: 'Papel inválido.' });

  const user = await findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Não é possível alterar o papel de um administrador.' });

  const updated = await updateUserRole(req.params.id, role);
  await audit('user.role_change', {
    actorId: req.user.id,
    metadata: { targetUserId: req.params.id, fromRole: user.role, toRole: role },
  });
  const { password: _, ...safe } = updated;
  res.json(safe);
});

router.delete('/teachers/:id', auth(['admin']), async (req, res) => {
  const users = await getAllUsers();
  const user = users.find((u) => u.id === req.params.id && u.role === 'teacher');
  if (!user) return res.status(404).json({ message: 'Professor não encontrado.' });
  await deleteUser(req.params.id);
  res.json({ message: 'Professor removido com sucesso.' });
});

module.exports = router;
