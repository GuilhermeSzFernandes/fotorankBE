const router = require('express').Router();
const auth = require('../middleware/auth');
const { getAllUsers, createUser, deleteUser, findUserByEmail, getMetrics } = require('../data/queries');

router.get('/metrics', auth(['admin']), async (req, res) => {
  res.json(await getMetrics());
});

router.get('/users', auth(['admin']), async (req, res) => {
  const users = await getAllUsers();
  res.json(users.map(({ password, ...u }) => u));
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

router.delete('/teachers/:id', auth(['admin']), async (req, res) => {
  const users = await getAllUsers();
  const user = users.find((u) => u.id === req.params.id && u.role === 'teacher');
  if (!user) return res.status(404).json({ message: 'Professor não encontrado.' });
  await deleteUser(req.params.id);
  res.json({ message: 'Professor removido com sucesso.' });
});

module.exports = router;
