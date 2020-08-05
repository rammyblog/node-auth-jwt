const jwt = require('jsonwebtoken');

module.exports = function verifiedFunction(req, res, next) {
  const token = req.header('auth-token');

  if (!token) return res.status(401).send('Access Denied');

  try {
    const verified = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = verified;
    return next();
  } catch (error) {
    return res.status(400).send('Invalid token');
  }
};
