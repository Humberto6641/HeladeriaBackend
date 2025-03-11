const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const router = express.Router();

///////////////////////////////////////////PRODUCTOS
// Ruta para registrar productos
router.post("/productos", async (req, res) => {
  const { nombre, tipo, precio, stock } = req.body;

  if (!nombre || !tipo || !precio || !stock) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const { data, error } = await supabase
    .from("producto") 
    .insert([{ nombre, tipo, precio, stock }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: "Producto creado con éxito", producto: data[0] });
});

// Ruta para otener todos los productos
router.get("/productos", async (req, res) => {
  const { data, error } = await supabase.from("producto").select("*");  // cAMBIAR LUEGO EL * 


  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
});
//ruta insertar producto
router.post("/productos", async (req, res) => {
  const { nombre, tipo, precio, stock } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO Producto (nombre, tipo, precio, stock) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *`,
      [nombre, tipo, precio, stock]
    );
    const producto = result.rows[0];

    if (producto) {
      res.status(201).json({ message: "Producto creado con éxito", producto });
    } else {
      res.status(500).json({ error: "No se pudo crear el producto" });
    }

  } catch (error) {
    console.error("Error al insertar el producto:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para obtener producto por ID
router.get('/productos/:id', async (req, res) => {
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

// Ruta para actualizar productos
router.put("/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, precio, stock } = req.body;

  if (!nombre || !tipo || !precio || !stock) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const { data, error } = await supabase
    .from("producto")
    .update({ nombre, tipo, precio, stock })
    .eq("id", id)
    .returning("*");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ message: "Producto actualizado con éxito", producto: data[0] });
});


//////////////////////////////////////////////VENTAS

// Ruta para registrar ventas
router.post("/ventas", async (req, res) => {
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

  // venta
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

////////////////////////////////////INVENTARIOS

// Ruta para obtener inventarios (sin join)
router.get("/inventarios", async (req, res) => {
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
// Ruta para registrar reposición de inventarios
router.post("/inventarios", async (req, res) => {
  const { id_producto, cantidad, fecha_reposicion } = req.body;

  if (!id_producto || !cantidad || !fecha_reposicion) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const { data, error } = await supabase
    .from("inventario")  
    .insert([{ id_producto, cantidad, fecha_reposicion }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const { data: productoData, error: productoError } = await supabase
    .from("producto")  
    .select("stock")
    .eq("id", id_producto)
    .single();

  if (productoError) {
    return res.status(500).json({ error: productoError.message });
  }

  const nuevoStock = productoData.stock + cantidad;

  await supabase
    .from("producto")  
    .update({ stock: nuevoStock })
    .eq("id", id_producto);

  res.status(201).json({ message: "Reposición de inventario registrada", inventario: data[0] });
});


//////////////////REPORTE
// Ruta para obtener reportes de ventas detallados
router.get("/reportes", async (req, res) => {
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
router.get("/reportes", async (req, res) => {
    const { data, error } = await supabase
      .from("venta")
      .select("fecha, total, id_usuario")
      .order("fecha", { ascending: false });
  
    if (error) {
      return res.status(500).json({ error: error.message });
    }
  
    res.status(200).json(data);
  });





module.exports = router;