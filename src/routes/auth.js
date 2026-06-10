const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  findUserByEmail,
  createUser,
  createResetToken,
  consumeResetToken,
  validateResetToken,
} = require('../data/mock');

router.post('/register', (req, res) => {
  const { name, email, password, etec, studentType, rm } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Preencha todos os campos.' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Senha deve ter ao menos 6 caracteres.' });
  if (findUserByEmail(email))
    return res.status(409).json({ message: 'E-mail já cadastrado.' });

  const user = createUser({ name, email, password, role: 'participant', etec: etec || null, studentType: studentType || null, rm: rm || null });
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Preencha todos os campos.' });

  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
  });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ message: 'E-mail é obrigatório.' });

  const token = createResetToken(email);
  if (!token) {
    // Always respond 200 to avoid enumeration
    return res.json({ message: 'Se este e-mail existir, um link foi gerado.' });
  }

  // Mock: return the token directly (production would send email)
  res.json({
    message: 'Link de recuperação gerado.',
    resetToken: token,
    resetUrl: `/reset-password?token=${token}`,
  });
});

router.get('/reset-password/validate', (req, res) => {
  const { token } = req.query;
  const email = validateResetToken(token);
  if (!email) return res.status(400).json({ valid: false });
  res.json({ valid: true, email });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ message: 'Dados incompletos.' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Senha deve ter ao menos 6 caracteres.' });

  const ok = consumeResetToken(token, password);
  if (!ok)
    return res.status(400).json({ message: 'Token inválido ou expirado.' });

  res.json({ message: 'Senha redefinida com sucesso.' });
});

module.exports = router;
