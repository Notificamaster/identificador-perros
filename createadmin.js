const mongoose = require('mongoose');
const Dog = require('./models/dog');

mongoose.connect('mongodb://localhost:27017/identificadores', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const exists = await Dog.findOne({ email: 'admin@admin.com' });
  if (exists) {
    console.log('El administrador ya existe.');
    process.exit();
  }

  const admin = new Dog({
    name: 'AdminDog',
    owner: 'Administrador',
    email: 'admin@admin.com',
    password: 'admin123',
    phone: '0000000000',
    breed: 'Control',
    food: 'Datos',
    illnesses: 'Ninguna',
    image: '',
    role: 'admin',
    createdAt: new Date()
  });

  await admin.save();
  console.log('✅ Administrador creado con éxito');
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit();
});

