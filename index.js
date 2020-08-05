/* eslint-disable no-console */
const express = require('express');

const app = express();

// Import Routes

const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const postRoute = require('./routes/post');
const authRoute = require('./routes/auth');
const docsRoute = require('./routes/docs');
const connectDB = require('./config/db');

dotenv.config();

// Connect to DB
connectDB();

// Middleware
// app.use(express.json())
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// Route middlewares
app.use('/api/user', authRoute);
app.use('/api/v1', docsRoute);
app.use('/api/post', postRoute);

app.listen(3000, () => console.log('Server up and running'));
