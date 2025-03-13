const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { registrarUsuario, loginUsuario } = require('./auth');  
const { verificarToken, verificarRol } = require('./auth');
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Rutas de autenticación
router.post("/register", registrarUsuario);
router.post("/login", loginUsuario);

// Rutas para productos
router.post("/productos", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { nombre, tipo, precio, stock } = req.body;

  if (!nombre || !tipo || !precio || !stock) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const { data, error } = await supabase
    .from("producto")
    .insert([{ nombre, tipo, precio, stock }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: "Producto creado con éxito", producto: data[0] });
});

// Ruta para obtener todos los productos
router.get("/productos", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { data, error } = await supabase.from("producto").select("id, nombre, tipo, precio, stock");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
});

// Ruta para obtener producto por ID
router.get('/productos/:id', verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const productoId = req.params.id;

  try {
    const { data, error } = await supabase.from("producto").select("*").eq('id', productoId).single();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener el producto', details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el producto', details: err.message });
  }
});

/// Ruta para eliminar un producto
router.delete("/productos/:id", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const productoId = req.params.id;

  try {
    const { data, error } = await supabase
      .from("producto")
      .delete()
      .eq("id", productoId)
      .returning("*");

    if (error) {
      return res.status(500).json({ error: 'Error al eliminar el producto', details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.status(200).json({ message: 'Producto eliminado con éxito', producto: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el producto', details: err.message });
  }
});

// Ruta para actualizar un producto
router.put("/productos/:id", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, precio, stock } = req.body;

  if (!nombre || !tipo || !precio || !stock) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const { data, error } = await supabase
      .from("producto")
      .update({ nombre, tipo, precio, stock })
      .eq("id", id)
      .returning("*");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.status(200).json({ message: "Producto actualizado con éxito", producto: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el producto', details: err.message });
  }
});

//////////////////////////////////////////////////ventas

// Rutas para ventas
router.post("/ventas", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { id_usuario, productos } = req.body;

  if (!id_usuario || !productos || productos.length === 0) {
    return res.status(400).json({ error: "Usuario y productos son obligatorios" });
  }
  let total = 0;
  for (const producto of productos) {
    const { id_producto, cantidad } = producto;

    const { data: productoData, error: productoError } = await supabase
      .from("producto")
      .select("precio, stock")
      .eq("id", id_producto)
      .single();

    if (productoError) {
      return res.status(500).json({ error: productoError.message });
    }

    const subtotal = productoData.precio * cantidad;
    total += subtotal;

    const newStock = productoData.stock - cantidad;
    await supabase
      .from("producto")
      .update({ stock: newStock })
      .eq("id", id_producto);
  }

  const { data: ventaData, error: ventaError } = await supabase
    .from("venta")
    .insert([{ id_usuario, fecha: new Date(), total }])
    .select("id")
    .single();

  if (ventaError) {
    return res.status(500).json({ error: ventaError.message });
  }

  const detalles = productos.map(async (producto) => {
    const { id_producto, cantidad } = producto;
    const subtotal = (await supabase.from("producto").select("precio").eq("id", id_producto).single()).data.precio * cantidad;

    await supabase.from("detalle_venta").insert([{
      id_venta: ventaData.id,
      id_producto,
      cantidad,
      subtotal,
    }]);
  });

  await Promise.all(detalles);

  res.status(201).json({ message: "Venta registrada con éxito", ventaId: ventaData.id });
});

// Rutas de reportes
router.get("/reportes/detalle", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { data, error } = await supabase
    .from("venta")
    .select(`
      id,
      fecha,
      total,
      id_usuario,
      detalle_venta (
        id_producto,
        cantidad,
        subtotal,
        producto (nombre, precio)
      )
    `)
    .order("fecha", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
});

// Ruta para obtener reportes de ventas
router.get("/reportes", verificarToken, verificarRol(['admin', 'vendedor']), async (req, res) => {
  const { data, error } = await supabase
    .from("venta")
    .select("fecha, total, id_usuario")
    .order("fecha", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
});





////////////////////////////////////INVENTARIOS

// Ruta para obtener inventarios
router.get("/inventarios" , verificarToken, verificarRol(['admin']), async (req, res) => {
  try {
    const { data: inventarios, error: inventariosError } = await supabase
      .from("inventario")
      .select("id_producto, cantidad, fecha_reposicion");
    if (inventariosError) {
      return res.status(500).json({ error: inventariosError.message });
    }
    const { data: productos, error: productosError } = await supabase
      .from("producto")
      .select("id, nombre");

    if (productosError) {
      return res.status(500).json({ error: productosError.message });
    }

    const inventariosConNombre = inventarios.map((inventario) => {
      const producto = productos.find(p => p.id === inventario.id_producto);
      return {
        ...inventario,
        nombre: producto ? producto.nombre : "Desconocido", 
      };
    });

    res.status(200).json(inventariosConNombre);
  } catch (error) {
    console.error("Error al obtener inventarios:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/inventarios", verificarToken, verificarRol(['admin']),  async (req, res) => {
  const { id_producto, cantidad, fecha_reposicion } = req.body;

  
  if (!id_producto || !cantidad || !fecha_reposicion) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  const { data, error } = await supabase
    .from("inventario")
    .insert([{ id_producto, cantidad, fecha_reposicion }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const { data: productoData, error: productoError } = await supabase
    .from("producto")
    .select("stock")
    .eq("id", id_producto)
    .single();

  if (productoError || !productoData) {
    return res.status(500).json({ error: "Producto no encontrado." });
  }

  const nuevoStock = productoData.stock + cantidad;

  // Actualizar el stock del producto
  const { error: updateError } = await supabase
    .from("producto")
    .update({ stock: nuevoStock })
    .eq("id", id_producto);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  res.status(201).json({
    message: "Reposición registrada correctamente y stock actualizado.",
    inventario: data[0],
    nuevoStock: nuevoStock
  });
});


// Ruta para obtener todos los usuarios (solo para admin)
router.get("/usuarios", verificarToken, verificarRol(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase.from("usuario").select("id, nombre, rol, nivel_acceso");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para obtener un usuario por ID (solo para admin)
router.get("/usuarios/:id", verificarToken, verificarRol(['admin']), async (req, res) => {
  const usuarioId = req.params.id;

  try {
    const { data, error } = await supabase.from("usuario").select("*").eq('id', usuarioId).single();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener el usuario', details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el usuario', details: err.message });
  }
});

// Ruta para eliminar un usuario (solo para admin)
router.delete("/usuarios/:id", verificarToken, verificarRol(['admin']), async (req, res) => {
  const usuarioId = req.params.id;

  try {
    const { data, error } = await supabase
      .from("usuario")
      .delete()
      .eq("id", usuarioId)
      .returning("*");

    if (error) {
      return res.status(500).json({ error: 'Error al eliminar el usuario', details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario eliminado con éxito', usuario: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el usuario', details: err.message });
  }
});


////////////////////Ruta para actualizar los usuarios solo rol y por el adminstrador
router.patch("/usuarios/:id", verificarToken, verificarRol(['admin']), async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;

  // Verificar que el rol esté presente
  if (!rol) {
    return res.status(400).json({ error: "El rol es obligatorio" });
  }

  console.log("ID recibido:", id);
  console.log("Rol recibido:", rol);

  try {
    const updateFields = { rol };

    const { data, error } = await supabase
      .from("usuario")
      .update(updateFields)
      .eq("id", id);

    if (error) {s
      console.error("Error en Supabase:", error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: "Rol del usuario actualizado con éxito", usuario: data[0] });
  } catch (err) {
    console.error("Error al actualizar:", err.message);
    res.status(500).json({ error: 'Error al actualizar el rol del usuario', details: err.message });
  }
});





module.exports = router;