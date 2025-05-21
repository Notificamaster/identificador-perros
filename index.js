// index.js actualizado para mostrar login general como página de inicio y permitir registro de usuarios

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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.error("❌ Error al conectar a MongoDB", err));

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
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}

// Mostrar login como página de inicio
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Login unificado para admin y usuarios
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await Dog.findOne({ email });
  if (!user || user.password !== password) {
    return res.send('Credenciales inválidas');
  }
  req.session.user = { id: user._id, role: user.role, email: user.email };
  if (user.role === 'admin') return res.redirect('/admin/register');
  res.redirect('/user/list');
});

// Formulario para registrar nuevos usuarios
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await Dog.findOne({ email });
  if (existing) return res.send('⚠️ Ya existe un usuario con ese correo.');

  const user = new Dog({ name, email, password, role: 'user' });
  await user.save();
  res.send('✅ Usuario registrado. Ahora puedes iniciar sesión en /login');
});

app.get('/user/list', requireUser, async (req, res) => {
  const dogs = await Dog.find({ email: req.session.user.email });
  res.render('user_list', { dogs });
});

app.get('/admin/list', requireAdmin, async (req, res) => {
  const dogs = await Dog.find();
  res.render('list', { dogs });
});

app.get('/admin/register', requireAdmin, (req, res) => {
  res.render('admin_register');
});

app.post('/admin/register', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, owner, email, phone, breed, food, illnesses } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : null;
  let existingUser = await Dog.findOne({ email });
  const password = existingUser ? existingUser.password : Math.random().toString(36).slice(-8);

  const dog = new Dog({
    name,
    owner,
    email,
    phone,
    breed,
    food,
    illnesses,
    image,
    password,
    role: 'user'
  });

  console.log(`🔐 Contraseña para ${email}: ${password}`);

  console.log(`🔐 Contraseña generada para ${email}: ${generatedPassword}`);
  await dog.save();
  res.redirect('/admin/register');
});

app.get('/admin/signup', (req, res) => {
  res.render('admin_signup');
});

app.post('/admin/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await Dog.findOne({ email });
  if (existing) return res.send('⚠️ Ya existe un usuario con ese correo.');

  const admin = new Dog({ name, email, password, role: 'admin' });
  await admin.save();
  res.send('✅ Administrador registrado con éxito. Ahora puedes ir a /login');
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

