const router = require("express").Router()
const verify = require("./verifyJwtToken")

router.get("/", verify, (req, res) => {
  res.json({ posts: { title: "My first post", content: "Private data" } })
})

module.exports = router
