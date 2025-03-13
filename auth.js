const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Función para registrar usuario con nombre y contraseña
async function registrarUsuario(req, res) {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: "Nombre y contraseña son obligatorios" });
  }

  // Hash de la contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("usuario")  // Asegúrate de que el nombre de la tabla esté en minúsculas
    .insert([{ nombre, password: hashedPassword, rol: 'vendedor', nivel_acceso: 1 }]) // Ajusta el rol si es necesario
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: "Usuario registrado con éxito" });
}

// Función para login con nombre y contraseña
async function loginUsuario(req, res) {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: "Nombre y contraseña son obligatorios" });
  }

  const { data, error } = await supabase
    .from("usuario")  // También en minúsculas aquí
    .select("id, nombre, rol, nivel_acceso, password")
    .eq('nombre', nombre)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: "Nombre o contraseña incorrectos" });
  }

  // Verificación de la contraseña
  const validPassword = await bcrypt.compare(password, data.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Nombre o contraseña incorrectos" });
  }

  // Generación del token JWT
  const token = jwt.sign({ id: data.id, nombre: data.nombre, rol: data.rol, nivel_acceso: data.nivel_acceso }, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.status(200).json({ message: "Inicio de sesión exitoso", token });
}


function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];  // Extraemos el token del encabezado

  if (!token) {
    return res.status(403).json({ error: 'Token requerido' });
  }

  // Verificamos el token usando la clave secreta
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token no válido' });
    }

    // Si el token es válido, guardamos los datos del usuario en la solicitud
    req.user = decoded;
    next();  // Pasamos al siguiente middleware o función
  });
}

function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    const userRol = req.user?.rol;  // Suponemos que el rol está en req.user tras verificar el token

    if (!rolesPermitidos.includes(userRol)) {
      return res.status(403).json({ error: 'Acceso denegado: Rol no autorizado' });
    }

    next();  // Si el rol es válido, pasamos al siguiente middleware o ruta
  };
}



module.exports = { verificarToken, verificarRol, registrarUsuario, loginUsuario };