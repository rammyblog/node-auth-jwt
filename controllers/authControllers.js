/* eslint-disable no-useless-return */
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
const passwordEncrypt = require('../utils/passwordEncrypt');
const {
  getUser,
  getUsers,
  getActiveUsers
} = require('../services/user.services');
const { getToken } = require('../services/Token.services');

const validation = {
  register: registerValidation,
  login: loginValidation,
  verifyUser: tokenValidation,
  ensureEmail: ensureEmailValidation,
  passwordReset: passwordResetValidation,
  passwordChange: passwordChangeValidation
};

const handleValidation = (body, res, type) => {
  const { error } = validation[type](body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }
  // eslint-disable-next-line consistent-return
  return;
};

const getAllUsers = async (req, res) => {
  try {
    const users = await getUsers({});
    return res.status(200).json({ data: users });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const getAllActiveUsers = async (req, res) => {
  try {
    const users = await getActiveUsers({ isActive: true });
    return res.status(200).json({ data: users });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const registerUser = async (req, res) => {
  // Validate data before creating a user
  handleValidation(req.body, res, 'register');

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
  handleValidation(req.body, res, 'login');

  try {
    //   Checking if the user is already in the db
    const user = await getUser({ email: req.body.email });
    //   Password check
    const validPass = await bcrypt.compare(req.body.password, user.password);

    if (!validPass) {
      return res.status(400).json({ error_msg: 'Invalid password' });
    }
    //   Create and assign a token
    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);
    return res.status(200).json({ access_token: token });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const verifyUserRegistration = async (req, res) => {
  // Validate the incoming data
  handleValidation(req.body, res, 'verifyUser');
  try {
    const token = await getToken({ token: req.body.token });
    const user = await getUser({ email: req.body.email });

    if (user.isActive) {
      return res.status(400).json({ error_msg: 'User already verified' });
    }

    // This should not even happen. I am checking if the user email matches the user id in the token
    if (!(token._userId !== user._id)) {
      return res.status(400).json({ error_msg: 'Token does not match user' });
    }

    user.isActive = true;
    await user.save();
    await token.remove();
    return res.status(200).json({ data: 'success' });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const resendVerificationToken = async (req, res) => {
  handleValidation(req.body, res, 'ensureEmail');

  const { email } = req.body;

  try {
    const user = await getUser({ email });
    if (user.isActive) {
      return res
        .status(400)
        .json({ error_msg: 'This user is already verified' });
    }
    // Generate and send token
    const token = await randomTokenGen(user);
    // send email using the token to user
    return res.status(200).json({ data: 'success' });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const sendPasswordResetToken = async (req, res) => {
  handleValidation(req.body, res, 'ensureEmail');

  const { email } = req.body;

  try {
    const user = await getUser({ email });
    // Generate and send token
    const token = await randomTokenGen(user);
    // send email to user
    return res.status(200).json({ data: token });
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

const passwordReset = async (req, res) => {
  handleValidation(req.body, res, 'passwordReset');
  const { email, reqToken, newPassword } = req.body;

  try {
    const token = await getToken({ token: reqToken });
    // User confimation
    const user = await getUser({ email });

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
    return res.status(400).json({ error_msg: err.message });
  }
};

const changePassword = async (req, res) => {
  handleValidation(req.body, res, 'passwordChange');

  const { newPassword, oldPassword } = req.body;

  if (newPassword === oldPassword) {
    return res.status(400).json({
      error_msg: 'New and Current password is the same, use a new password'
    });
  }

  try {
    const user = await getUser({ _id: req.user._id });
    // Ensure old password is equal to db pass
    const validPass = await bcrypt.compare(oldPassword, user.password);

    if (!validPass) {
      return res.status(400).json({ error_msg: 'Current password is wrong' });
    }
    // Ensure new password not equals to old password
    user.password = await passwordEncrypt(newPassword);
    await user.save();
    return res.json('Success');
  } catch (err) {
    return res.status(400).json({ error_msg: err.message });
  }
};

module.exports = {
  getAllUsers,
  getAllActiveUsers,
  registerUser,
  loginUser,
  verifyUserRegistration,
  resendVerificationToken,
  sendPasswordResetToken,
  passwordReset,
  changePassword
};
