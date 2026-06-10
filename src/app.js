require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/photos',  require('./routes/photos'));
app.use('/api/grades',  require('./routes/grades'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: err.message || 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
