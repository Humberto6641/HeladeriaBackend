/*const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// Middleware de autenticación
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'Acceso denegado, token requerido' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Decodificamos el token y obtenemos el usuario
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Middleware de autorización basado en rol
const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        // Verificar si el rol del usuario está en los roles permitidos
        if (!rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({ error: 'Acceso denegado, rol no autorizado' });
        }
        next();
    };
};

// Rutas de ejemplo con seguridad
// Solo el admin puede acceder a esta ruta
router.get('/productos', verificarToken, verificarRol(['admin']), (req, res) => {
    res.json({ message: 'Acceso permitido a productos para admin' });
});

// Solo el vendedor puede acceder a esta ruta
router.post('/ventas', verificarToken, verificarRol(['vendedor']), (req, res) => {
    res.json({ message: 'Venta registrada correctamente' });
});

module.exports = { router, verificarToken, verificarRol };*/