const router = require('express').Router();
const auth = require('../middleware/auth');
const { users, createUser, deleteUser, getMetrics } = require('../data/mock');

router.get('/metrics', auth(['admin']), (req, res) => {
  res.json(getMetrics());
});

router.get('/users', auth(['admin']), (req, res) => {
  const safe = users.map(({ password, ...u }) => u);
  res.json(safe);
});

router.get('/teachers', auth(['admin']), (req, res) => {
  const teachers = users
    .filter((u) => u.role === 'teacher')
    .map(({ password, ...u }) => u);
  res.json(teachers);
});

router.post('/teachers', auth(['admin']), (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Preencha todos os campos.' });
  }

  const { findUserByEmail } = require('../data/mock');
  if (findUserByEmail(email)) {
    return res.status(409).json({ message: 'E-mail já cadastrado.' });
  }

  const user = createUser({ name, email, password, role: 'teacher' });
  const { password: _, ...safe } = user;
  res.status(201).json(safe);
});

router.delete('/teachers/:id', auth(['admin']), (req, res) => {
  const user = users.find((u) => u.id === req.params.id && u.role === 'teacher');
  if (!user) {
    return res.status(404).json({ message: 'Professor não encontrado.' });
  }
  deleteUser(req.params.id);
  res.json({ message: 'Professor removido com sucesso.' });
});

module.exports = router;
