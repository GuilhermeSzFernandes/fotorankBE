const router = require('express').Router();
const { getRanking } = require('../data/queries');

router.get('/', async (req, res) => {
  res.json(await getRanking());
});

module.exports = router;
