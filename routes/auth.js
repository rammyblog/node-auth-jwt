const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const {
  registerValidation,
  loginValidation,
  tokenValidation,
  ensureEmailValidation,
  passwordResetValidation
} = require('../utils/validation');
const jwt = require('jsonwebtoken');
const randomTokenGen = require('../utils/generateToken');
const Token = require('../models/Token');
const ensureAuth = require('./verifyJwtToken');
const passwordEncrypt = require('../utils/passwordEncrypt');

router.post('/register', async (req, res) => {
  // Validate data before creating a user
  const { error } = registerValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  //   Checking if the user is already in the db
  const emailExist = await User.findOne({ email: req.body.email });

  if (emailExist) {
    return res.status(400).json({ error_msg: 'E-Mail already exists' });
  }

  //   Hash password
  try {
    req.body.password = passwordEncrypt(req.body.password);
  } catch (error) {
    return res.status(400).json({ error_msg: error });
  }
  //Create a new user
  const user = new User(req.body);

  try {
    const savedUser = await user.save();
    // Generate and send token
    const token = await randomTokenGen(savedUser);
    // const userToken = new Token({ _userId: savedUser._id, token: token })
    // await userToken.save()
    if (!token) {
      res.status(500).json({ error_msg: 'An error occured' });
    }
    // Send email using sendgrid here
    res.status(201).json({ data: savedUser });
  } catch (error) {
    res.status(400).json(error);
  }
});

router.post('/login', async (req, res) => {
  // Validate data before creating a user
  const { error } = loginValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  //   Checking if the user is already in the db
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(400).json({ error_msg: 'Email or password is wrong' });
  }

  //   Password check
  const validPass = await bcrypt.compare(req.body.password, user.password);

  if (!validPass) {
    return res.status(400).json({ error_msg: 'Invalid password' });
  }
  //   Create and assign a token
  const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);
  res.header('auth-token', token).send(token);
});

// Verify a user account
router.post('/verify', async (req, res) => {
  // Validate the incoming data
  const { error } = tokenValidation(req.body);

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const token = await Token.findOne({ token: req.body.token });

    if (!token) {
      return res
        .status(400)
        .json({ error_msg: 'Unable to find a matching token' });
    }
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(400).json({ error_msg: 'User not found ' });
    }

    // This should not even happen. I am checking if the user email matches the user id in the token

    if (!(token._userId != user._id)) {
      return res.status(400).json({ error_msg: 'Token does not match user' });
    }

    if (user.isActive) {
      return res.status(400).json({ error_msg: 'User already verified' });
    }

    user.isActive = true;
    await user.save();
    // Delete token if user is verified
    // await token.remove()
    return res.status(200).json({ data: 'success' });
  } catch (error) {
    return res.status(400).json({ error_msg: error });
  }
});

// Resent account verification token

router.post('/resend-verification-token', async (req, res) => {
  const { error } = ensureEmailValidation(req.body);
  const { email } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(400)
        .json({ error_msg: 'User with this email not found' });
    }

    if (user.isActive) {
      return res
        .status(400)
        .json({ error_msg: 'This user is already verified' });
    }
    // Generate and send token
    const token = await randomTokenGen(user);
    // send email to user
    return res.status(200).json({ data: token });
  } catch (error) {
    return res.status(400).json({ error_msg: error });
  }
});

// Password reset token
router.post('/send-password-reset-token', async (req, res) => {
  const { error } = ensureEmailValidation(req.body);
  const { email } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(400)
        .json({ error_msg: 'User with this email not found' });
    }

    // Generate and send token
    const token = await randomTokenGen(user);
    // send email to user
    return res.status(200).json({ data: token });
  } catch (error) {
    return res.status(400).json({ error_msg: error });
  }
});

// Password reset
router.post('/password-reset', async (req, res) => {
  const { error } = passwordResetValidation(req.body);
  const { email, token, newPassword } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const token = await Token.findOne({ token: req.body.token });
    // Token confirmation
    if (!token) {
      return res
        .status(400)
        .json({ error_msg: 'Unable to find a matching token' });
    }

    // User confimation
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(400)
        .json({ error_msg: 'User with this email not found' });
    }

    // Ensure new password not equals to old password
    const passwordCompare = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (passwordCompare) {
      return res
        .status(400)
        .json({ error_msg: "You can't use this password again" });
    } else {
      user.password = passwordEncrypt(req.body.password);
      await user.save();
      // Send an email to the user telling the password change successful
      return res.status(200).json({ data: 'Success' });
    }
  } catch (error) {
    return res.status(400).json({ error_msg: error });
  }
});

module.exports = router;
