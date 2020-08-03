const router = require("express").Router()
const User = require("../models/User")
const bcrypt = require("bcryptjs")
const { registerValidation, loginValidation } = require("../validation")
const jwt = require("jsonwebtoken")

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
    // await delete savedUser["password"]

    res.status(201).json({ data: savedUser })
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

module.exports = router
