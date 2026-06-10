const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const {
  findUserById,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
} = require('../data/mock');

const avatarsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: avatarsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else
      cb(new Error('Apenas JPEG, PNG ou WebP são aceitos.'));
  },
});

router.get('/', auth(), (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const { password, ...safe } = user;
  res.json(safe);
});

router.put('/', auth(), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ message: 'Nome é obrigatório.' });

  const user = updateUserProfile(req.user.id, { name: name.trim() });
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const { password, ...safe } = user;
  res.json(safe);
});

router.post('/avatar', auth(), upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  updateUserAvatar(req.user.id, avatarUrl);
  res.json({ avatar: avatarUrl });
});

router.post('/change-password', auth(), (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Preencha todos os campos.' });
  if (newPassword.length < 6)
    return res.status(400).json({ message: 'Nova senha deve ter ao menos 6 caracteres.' });

  const user = findUserById(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ message: 'Senha atual incorreta.' });

  changeUserPassword(req.user.id, newPassword);
  res.json({ message: 'Senha alterada com sucesso.' });
});

module.exports = router;
