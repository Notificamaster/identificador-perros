// index.js actualizado con restauración de filtro 'role: user'
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const Dog = require('./models/dog');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.error("❌ Error al conectar a MongoDB", err));

app.use(session({
  secret: 'clave_secreta_segura',
  resave: false,
  saveUninitialized: false
}));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'dog-id',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
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

app.get('/', (req, res) => {
  res.redirect('/login');
});

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
  const dogs = await Dog.find({ role: 'user' });
  const success = req.query.success === '1';
  res.render('list', { dogs, success });
});

app.get('/admin/list', requireAdmin, async (req, res) => {
  const { owner } = req.query;

  const query = { role: 'user' };
  if (owner) query.owner = owner;

  const owners = await Dog.distinct("owner", { role: 'user' });
  const dogs = await Dog.find(query);
  const success = req.query.success === '1';

  res.render('list', { dogs, success, owners, selectedOwner: owner });
});


app.post('/admin/register', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, owner, email, phone, breed, food, illnesses } = req.body;
  const image = req.file ? req.file.path : null;

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
  await dog.save();
  res.redirect(`/dog/${dog._id}`);
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

app.post('/dog/:id/location', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    const dog = await Dog.findByIdAndUpdate(req.params.id, {
      lastLocation: { lat, lon, date: new Date() }
    }, { new: true });

    if (!dog || !dog.email) return res.sendStatus(200);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: dog.email,
      subject: `📍 Se ha escaneado el tag de tu perro: ${dog.name}`,
      html: `
        <p>Hola <strong>${dog.owner}</strong>,</p>
        <p>Tu perro <strong>${dog.name}</strong> ha sido escaneado.</p>
        <p><strong>Ubicación:</strong> 
        <a href="https://maps.google.com/?q=${lat},${lon}" target="_blank">Ver en Google Maps</a></p>
        <p>Hora del escaneo: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>
        <br>
        <p>Este es un mensaje automático del sistema de identificación de perros 🐾</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Correo enviado a ${dog.email}`);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error al guardar ubicación o enviar correo:", err);
    res.status(500).send('Error al guardar ubicación o enviar correo');
  }
});

app.get('/admin/edit/:id', requireAdmin, async (req, res) => {
  const dog = await Dog.findById(req.params.id);
  res.render('admin_edit', { dog });
});

app.post('/admin/edit/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, owner, email, phone, breed, food, illnesses } = req.body;
  const update = {
    name, owner, email, phone, breed, food, illnesses
  };

  if (req.file) {
    update.image = req.file.path;
  }

  await Dog.findByIdAndUpdate(req.params.id, update);
  res.redirect('/admin/list?success=1');
});

app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  await Dog.findByIdAndDelete(req.params.id);
  res.redirect('/admin/list?success=1');
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

