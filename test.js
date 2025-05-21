require('mongoose').connect(
  'mongodb+srv://javiertolk:qo3LWMZwVOclhWGN@dogid.3beukvh.mongodb.net/dogid?retryWrites=true&w=majority&appName=dogid',
  { useNewUrlParser: true, useUnifiedTopology: true }
).then(() => {
  console.log('✅ Conectado');
  process.exit();
}).catch(err => {
  console.error('❌ Falló conexión:', err);
  process.exit(1);
});

