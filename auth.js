const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Función registrar usuario
async function registrarUsuario(req, res) {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: "Nombre y contraseña son obligatorios" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("usuario")  
    .insert([{ nombre, password: hashedPassword, rol: 'vendedor', nivel_acceso: 1 }]) 
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: "Usuario registrado con éxito" });
}

// Función para login 
async function loginUsuario(req, res) {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: "Nombre y contraseña son obligatorios" });
  }

  const { data, error } = await supabase
    .from("usuario")  
    .select("id, nombre, rol, nivel_acceso, password")
    .eq('nombre', nombre)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: "Nombre o contraseña incorrectos" });
  }

  
  const validPassword = await bcrypt.compare(password, data.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Nombre o contraseña incorrectos" });
  }

  
  const token = jwt.sign(
    { id: data.id, nombre: data.nombre, rol: data.rol, nivel_acceso: data.nivel_acceso },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  
  res.status(200).json({ message: "Inicio de sesión exitoso", token });
}

// Middleware para verificar el token 
function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];  

  if (!token) {
    return res.status(403).json({ error: 'Token requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token no válido' });
    }

    req.user = decoded;
    next();  
  });
}


function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    const userRol = req.user?.rol;  

    if (!rolesPermitidos.includes(userRol)) {
      return res.status(403).json({ error: 'Acceso denegado: Rol no autorizado' });
    }

    next();  
  };
}

module.exports = { verificarToken, verificarRol, registrarUsuario, loginUsuario };