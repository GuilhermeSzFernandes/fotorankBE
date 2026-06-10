const jwt = require('jsonwebtoken');

function authMiddleware(roles = []) {
  return (req, res, next) => {
    const token = req.cookies?.token
      || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) return res.status(401).json({ message: 'Não autenticado.' });

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      if (roles.length > 0 && !roles.includes(payload.role))
        return res.status(403).json({ message: 'Acesso negado.' });
      next();
    } catch {
      return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
    }
  };
}

module.exports = authMiddleware;
