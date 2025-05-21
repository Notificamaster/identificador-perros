// index.js actualizado con conexión limpia y sin warnings para Railway
// prueba de despliegue railway
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const Dog = require('./models/Dog');

// Conexión limpia a MongoDB Atlas sin opciones obsoletas
console.log("MONGO_URI →", process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('❌ Error al conectar a MongoDB', err);
  });

app.use(session({
  secret: 'clave_secreta_segura',
  resave: false,
  saveUninitialized: false
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function requireUser(req, res, next) {
  if (req.session.user && req.session.user.role === 'user') return next();
  res.redirect('/user/login');
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}

app.get('/', (req, res) => {
  res.redirect('/user/login');
});

app.get('/user/login', (req, res) => {
  res.render('user_login');
});

app.post('/user/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await Dog.findOne({ email, role: 'user' });
  if (!user || user.password !== password) {
    return res.send('Credenciales inválidas');
  }
  req.session.user = { id: user._id, role: user.role, email: user.email };
  res.redirect('/user/list');
});

app.get('/user/list', requireUser, async (req, res) => {
  const dogs = await Dog.find({ email: req.session.user.email });
  res.render('user_list', { dogs });
});

app.get('/admin/list', requireAdmin, async (req, res) => {
  const dogs = await Dog.find();
  res.render('list', { dogs });
});

app.post('/admin/register', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, owner, email, phone, breed, food, illnesses } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : null;
  const dog = new Dog({ name, owner, email, phone, breed, food, illnesses, image, password: 'admin-added', role: 'user' });
  await dog.save();
  res.redirect('/admin/list');
});

app.get('/dog/:id', async (req, res) => {
  try {
    const dog = await Dog.findById(req.params.id);
    res.render('dog', {
      id: dog._id,
      name: dog.name,
      owner: dog.owner,
      phone: dog.phone,
      email: dog.email,
      breed: dog.breed,
      food: dog.food,
      illnesses: dog.illnesses,
      image: dog.image,
      lastLocation: dog.lastLocation,
      success: null
    });
  } catch (err) {
    res.status(500).send('Error al buscar el perro');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

