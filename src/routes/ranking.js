const router = require('express').Router();
const { getRanking } = require('../data/mock');

router.get('/', (req, res) => {
  res.json(getRanking());
});

module.exports = router;
