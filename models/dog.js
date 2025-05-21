const mongoose = require('mongoose');

const dogSchema = new mongoose.Schema({
  name: String,
  owner: String,
  email: String,
  phone: String,
  breed: String,
  food: String,
  illnesses: String,
  image: String,
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  lastLocation: {
    lat: Number,
    lon: Number,
    date: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Dog', dogSchema);

