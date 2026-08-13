require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./lib/db');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS não permitido para esta origem.'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/photos',  require('./routes/photos'));
app.use('/api/grades',  require('./routes/grades'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/contest', require('./routes/contest'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/users',   require('./routes/users'));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: err.message || 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;

initDb()
  .then(() => app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`)))
  .catch((err) => { console.error('Falha ao inicializar DB:', err.message); process.exit(1); });
