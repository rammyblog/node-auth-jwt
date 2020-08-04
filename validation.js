const Joi = require("@hapi/joi")

// Register validation
const registerValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(6).required(),
    email: Joi.string().min(6).required().email(),
    password: Joi.string().min(6).required(),
  })

  return schema.validate(data)
}

// Login validation
const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().min(6).required().email(),
    password: Joi.string().min(6).required(),
  })

  return schema.validate(data)
}

// token verifit validation
const tokenValidation = (data) => {
  const schema = Joi.object({
    token: Joi.string().required(),
    email: Joi.string().min(6).required().email(),
  })

  return schema.validate(data)
}

// token resend validation
const resendTokenValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().min(6).required().email(),
  })

  return schema.validate(data)
}

// module.exports.registerValidation = registerValidation
// module.exports.loginValidation = loginValidation
// module.exports.tokenValidation = tokenValidation
module.exports = {
  loginValidation,
  registerValidation,
  tokenValidation,
  resendTokenValidation,
}
