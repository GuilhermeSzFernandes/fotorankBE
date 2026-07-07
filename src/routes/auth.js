const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const {
  findUserByEmail,
  findUserById,
  createUser,
  createResetToken,
  consumeResetToken,
  validateResetToken,
} = require('../data/queries');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidCPF(cpf) {
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheck = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcCheck(9) === Number(digits[9]) && calcCheck(10) === Number(digits[10]);
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, etec, studentType, cpf, phone } = req.body;
    if (!name || !email || !password || !cpf || !phone)
      return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    if (!EMAIL_RE.test(email.trim()))
      return res.status(400).json({ message: 'Informe um e-mail válido.' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Senha deve ter ao menos 6 caracteres.' });
    if (!isValidCPF(cpf))
      return res.status(400).json({ message: 'Informe um CPF válido.' });
    if (phone.replace(/\D/g, '').length < 10)
      return res.status(400).json({ message: 'Informe um telefone válido.' });
    if (await findUserByEmail(email))
      return res.status(409).json({ message: 'E-mail já cadastrado.' });

    const user = await createUser({ name, email, password, role: 'participant', etec: etec || null, studentType: studentType || null, cpf, phone: phone.trim() });
    const token = signToken(user);
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
    res.cookie('token', token, COOKIE_OPTIONS).status(201).json({ user: safeUser });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'CPF ou e-mail já cadastrado.' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Preencha todos os campos.' });

  const user = await findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

  const token = signToken(user);
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
  res.cookie('token', token, COOKIE_OPTIONS).json({ user: safeUser });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 }).json({ message: 'Logout realizado.' });
});

router.get('/me', authMiddleware(), async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(401).json({ message: 'Usuário não encontrado.' });
  const { password, ...safe } = user;
  res.json(safe);
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

  const token = await createResetToken(email);
  if (!token) return res.json({ message: 'Se este e-mail existir, um link foi gerado.' });

  res.json({ message: 'Link de recuperação gerado.', resetToken: token, resetUrl: `/reset-password?token=${token}` });
});

router.get('/reset-password/validate', async (req, res) => {
  const { token } = req.query;
  const email = await validateResetToken(token);
  if (!email) return res.status(400).json({ valid: false });
  res.json({ valid: true, email });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Dados incompletos.' });
  if (password.length < 6) return res.status(400).json({ message: 'Senha deve ter ao menos 6 caracteres.' });

  const ok = await consumeResetToken(token, password);
  if (!ok) return res.status(400).json({ message: 'Token inválido ou expirado.' });
  res.json({ message: 'Senha redefinida com sucesso.' });
});

module.exports = router;
