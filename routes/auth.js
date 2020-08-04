const router = require("express").Router()
const User = require("../models/User")
const bcrypt = require("bcryptjs")
const {
  registerValidation,
  loginValidation,
  tokenValidation,
} = require("../validation")
const jwt = require("jsonwebtoken")
const Token = require("../models/Token")

router.post("/register", async (req, res) => {
  // Validate data before creating a user
  const { error } = registerValidation(req.body)
  if (error) {
    return res.status(400).send(error.details[0].message)
  }

  //   Checking if the user is already in the db
  const emailExist = await User.findOne({ email: req.body.email })

  if (emailExist) {
    return res.status(400).json({ error_msg: "E-Mail already exists" })
  }

  //   Hash password
  try {
    const SALT = await bcrypt.genSalt(10)
    req.body.password = await bcrypt.hash(req.body.password, SALT)
  } catch (error) {
    return res.status(400).json({ error_msg: error })
  }
  //Create a new user
  const user = new User(req.body)

  try {
    const savedUser = await user.save()
    res.status(201).json({ data: savedUser })
    // Generate and send token
  } catch (error) {
    res.status(400).json(error)
  }
})

router.post("/login", async (req, res) => {
  // Validate data before creating a user
  const { error } = loginValidation(req.body)
  if (error) {
    return res.status(400).send(error.details[0].message)
  }

  //   Checking if the user is already in the db
  const user = await User.findOne({ email: req.body.email })

  if (!user) {
    return res.status(400).json({ error_msg: "Email or password is wrong" })
  }

  //   Password check
  const validPass = await bcrypt.compare(req.body.password, user.password)

  if (!validPass) {
    return res.status(400).json({ error_msg: "Invalid password" })
  }
  //   Create and assign a token
  const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET)
  res.header("auth-token", token).send(token)
})

router.post("/verify", async (req, res) => {
  // Validate the incoming data
  const { error } = tokenValidation(req.body)

  if (error) {
    return res.status(400).json({ error_msg: error.details[0].message })
  }

  try {
    const token = await Token.findOne({ token: req.body.token })

    if (!token) {
      return res
        .status(400)
        .json({ error_msg: "Unable to find a matching token" })
    }
    const user = await User.findOne({ email: req.body.email })

    if (!user) {
      return res.status(400).json({ error_msg: "User not found " })
    }

    // This should not even happen. I am checking if the user email matches the user id in the token
    if (!token._userId != user._id) {
      return res.status(400).json({ error_msg: "Token does not match user" })
    }

    if (user.isActive) {
      return res.status(400).json({ error_msg: "User already verified" })
    }

    user.isActive = true
    await user.save()
    // Delete token if user is verified
    await token.deleteOne()
  } catch (error) {
    return res.status(400).json({ error_msg: error })
  }
})

module.exports = router
