/* eslint-disable no-underscore-dangle */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  registerValidation,
  loginValidation,
  tokenValidation,
  ensureEmailValidation,
  passwordResetValidation,
  passwordChangeValidation
} = require('../utils/validation');
const randomTokenGen = require('../utils/generateToken');
const Token = require('../models/Token');
const passwordEncrypt = require('../utils/passwordEncrypt');

const registerUser = async (req, res) => {
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
    req.body.password = await passwordEncrypt(req.body.password);
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
  // Create a new user
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
    return res.status(201).json({ data: savedUser });
  } catch (err) {
    return res.status(400).json(err);
  }
};

const loginUser = async (req, res) => {
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
  return res.header('auth-token', token).send(token);
};

const verifyUserRegistration = async (req, res) => {
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

    if (!(token._userId !== user._id)) {
      return res.status(400).json({ error_msg: 'Token does not match user' });
    }

    if (user.isActive) {
      return res.status(400).json({ error_msg: 'User already verified' });
    }

    user.isActive = true;
    await user.save();
    // Delete token if user is verified
    await token.remove();
    return res.status(200).json({ data: 'success' });
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
};

const resendVerificationToken = async (req, res) => {
  const { error } = ensureEmailValidation(req.body);
  const { email } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const user = await User.findOne({ email });
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
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
};

const sendPasswordResetToken = async (req, res) => {
  const { error } = ensureEmailValidation(req.body);
  const { email } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ error_msg: 'User with this email not found' });
    }

    // Generate and send token
    const token = await randomTokenGen(user);
    // send email to user
    return res.status(200).json({ data: token });
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
};

const passwordReset = async (req, res) => {
  const { error } = passwordResetValidation(req.body);
  const { email, reqToken, newPassword } = req.body;

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }

  try {
    const token = await Token.findOne({ token: reqToken });
    // Token confirmation
    if (!token) {
      return res
        .status(400)
        .json({ error_msg: 'Unable to find a matching token' });
    }

    // User confimation
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ error_msg: 'User with this email not found' });
    }

    // Ensure new password not equals to old password
    const passwordCompare = await bcrypt.compare(newPassword, user.password);

    if (passwordCompare) {
      return res
        .status(400)
        .json({ error_msg: "You can't use this password again" });
    }
    user.password = await passwordEncrypt(req.body.password);
    await user.save();
    // Delete token if user is verified
    await token.remove();
    // Send an email to the user telling the password change successful
    return res.status(200).json({ data: 'Success' });
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
};

const changePassword = async (req, res) => {
  const { error } = passwordChangeValidation(req.body);

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message });
  }
  const { newPassword, oldPassword } = req.body;

  if (newPassword === oldPassword) {
    return res.status(400).json({
      error_msg: 'New and Current password is the same, use a new password'
    });
  }

  try {
    const user = await User.findOne({ _id: req.user._id });

    if (!user) {
      return res.status(400).json({ error_msg: 'User not found' });
    }
    // Ensure old password is equal to db pass
    const validPass = await bcrypt.compare(oldPassword, user.password);

    if (!validPass) {
      return res.status(400).json({ error_msg: 'Current password is wrong' });
    }
    // Ensure new password not equals to old password
    user.password = await passwordEncrypt(newPassword);
    await user.save();
    return res.json('Password changed successfully');
  } catch (err) {
    return res.status(400).json({ error_msg: err });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyUserRegistration,
  resendVerificationToken,
  sendPasswordResetToken,
  passwordReset,
  changePassword
};
