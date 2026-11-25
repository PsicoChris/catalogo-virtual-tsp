const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database', 'catalogo.db');
let db;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params = []) {
  db.run(sql, params);
  const lastIdRow = queryOne('SELECT last_insert_rowid() AS id');
  saveDb();
  return lastIdRow ? lastIdRow.id : null;
}

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  db.exec(schema);

  const countRow = queryOne('SELECT COUNT(*) AS total FROM articulos');
  if (!countRow || countRow.total === 0) {
    const productos = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'database', 'productos.json'), 'utf8')
    );
    for (const p of productos) {
      db.run(
        `INSERT INTO articulos (id, nombre, categoria, descripcion, precio, stock, imagen)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.nombre, p.categoria, p.descripcion, p.precio, p.stock, p.imagen]
      );
    }
    saveDb();
    console.log(`Catálogo inicial cargado con ${productos.length} artículos.`);
  }
}

// --- MÓDULO 1: REGISTRO E INICIO DE SESIÓN ---
app.post('/api/auth/registro', (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password || password.length < 6) {
      return res.status(400).json({
        error: 'Nombre, correo válido y contraseña de mínimo 6 caracteres son obligatorios.'
      });
    }

    const existe = queryOne('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario registrado con ese correo.' });
    }

    const usuarioId = execute(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
      [nombre.trim(), email.trim().toLowerCase(), hashPassword(password)]
    );

    execute('INSERT INTO carritos (usuario_id, estado) VALUES (?, ?)', [usuarioId, 'activo']);

    res.status(201).json({
      usuario: { id: usuarioId, nombre: nombre.trim(), email: email.trim().toLowerCase() }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
    }

    const user = queryOne(
      'SELECT id, nombre, email, password_hash FROM usuarios WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    let carrito = queryOne(
      "SELECT id FROM carritos WHERE usuario_id = ? AND estado = 'activo' ORDER BY id DESC LIMIT 1",
      [user.id]
    );
    if (!carrito) {
      const carritoId = execute('INSERT INTO carritos (usuario_id, estado) VALUES (?, ?)', [user.id, 'activo']);
      carrito = { id: carritoId };
    }

    res.json({
      usuario: { id: user.id, nombre: user.nombre, email: user.email },
      carritoId: carrito.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// --- MÓDULOS 2, 3 Y 4: BÚSQUEDA BÁSICA, AVANZADA Y CATÁLOGO ---
app.get('/api/articulos', (req, res) => {
  try {
    const { q, categoria, precioMin, precioMax, soloDisponibles } = req.query;
    let sql = 'SELECT * FROM articulos WHERE 1=1';
    const params = [];

    if (q && q.trim() !== '') {
      sql += ' AND LOWER(nombre) LIKE ?';
      params.push(`%${q.trim().toLowerCase()}%`);
    }

    if (categoria && categoria !== 'todas') {
      sql += ' AND categoria = ?';
      params.push(categoria);
    }

    if (precioMin !== undefined && precioMin !== '' && !Number.isNaN(Number(precioMin))) {
      sql += ' AND precio >= ?';
      params.push(Number(precioMin));
    }

    if (precioMax !== undefined && precioMax !== '' && !Number.isNaN(Number(precioMax))) {
      sql += ' AND precio <= ?';
      params.push(Number(precioMax));
    }

    if (soloDisponibles === 'true') {
      sql += ' AND stock > 0';
    }

    sql += ' ORDER BY id ASC';
    const articulos = queryAll(sql, params);
    res.json(articulos);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar artículos.' });
  }
});

// --- MÓDULOS 5 Y 6: COMPRA POR ARTÍCULO Y CARRO DE COMPRAS ---
function obtenerCarritoDetalle(usuarioId) {
  let carrito = queryOne(
    "SELECT id FROM carritos WHERE usuario_id = ? AND estado = 'activo' ORDER BY id DESC LIMIT 1",
    [usuarioId]
  );
  if (!carrito) {
    const carritoId = execute('INSERT INTO carritos (usuario_id, estado) VALUES (?, ?)', [usuarioId, 'activo']);
    carrito = { id: carritoId };
  }

  const items = queryAll(
    `SELECT dc.id, dc.articulo_id, dc.cantidad, dc.precio_unitario,
            a.nombre, a.categoria, a.stock AS stock_actual, a.imagen,
            (dc.cantidad * dc.precio_unitario) AS subtotal
     FROM detalle_carrito dc
     JOIN articulos a ON a.id = dc.articulo_id
     WHERE dc.carrito_id = ?`,
    [carrito.id]
  );

  const totalCantidad = items.reduce((acc, item) => acc + item.cantidad, 0);
  const totalPagar = items.reduce((acc, item) => acc + item.subtotal, 0);

  return { carritoId: carrito.id, items, totalCantidad, totalPagar };
}

app.get('/api/carrito/:usuarioId', (req, res) => {
  try {
    const data = obtenerCarritoDetalle(Number(req.params.usuarioId));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el carrito.' });
  }
});

app.post('/api/carrito/agregar', (req, res) => {
  try {
    const { usuarioId, articuloId, cantidad } = req.body;
    const cant = Number(cantidad);

    if (!usuarioId) {
      return res.status(401).json({
        error: 'Debes iniciar sesión o registrarte para agregar artículos al carrito.'
      });
    }

    if (!articuloId || !Number.isInteger(cant) || cant <= 0) {
      return res.status(400).json({ error: 'Selecciona una cantidad válida mayor a 0.' });
    }

    const articulo = queryOne('SELECT * FROM articulos WHERE id = ?', [Number(articuloId)]);
    if (!articulo) {
      return res.status(404).json({ error: 'El artículo no existe.' });
    }

    if (articulo.stock <= 0 || cant > articulo.stock) {
      return res.status(400).json({
        error: `Stock insuficiente (RN-04). Disponible: ${articulo.stock} unidades.`
      });
    }

    const carritoInfo = obtenerCarritoDetalle(Number(usuarioId));
    const existente = carritoInfo.items.find((i) => i.articulo_id === Number(articuloId));

    if (existente) {
      const nuevaCantidad = existente.cantidad + cant;
      if (nuevaCantidad > articulo.stock) {
        return res.status(400).json({
          error: `No puedes superar el stock disponible (${articulo.stock} unidades).`
        });
      }
      execute('UPDATE detalle_carrito SET cantidad = ? WHERE id = ?', [nuevaCantidad, existente.id]);
    } else {
      execute(
        `INSERT INTO detalle_carrito (carrito_id, articulo_id, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [carritoInfo.carritoId, articulo.id, cant, articulo.precio]
      );
    }

    const actualizado = obtenerCarritoDetalle(Number(usuarioId));
    res.json(actualizado);
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar el artículo al carrito.' });
  }
});

app.delete('/api/carrito/item/:detalleId', (req, res) => {
  try {
    const { usuarioId } = req.query;
    execute('DELETE FROM detalle_carrito WHERE id = ?', [Number(req.params.detalleId)]);
    const actualizado = obtenerCarritoDetalle(Number(usuarioId));
    res.json(actualizado);
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar ítem del carrito.' });
  }
});

app.post('/api/pedidos/confirmar', (req, res) => {
  try {
    const { usuarioId } = req.body;
    if (!usuarioId) {
      return res.status(401).json({ error: 'Debes iniciar sesión para confirmar un pedido.' });
    }

    const carritoInfo = obtenerCarritoDetalle(Number(usuarioId));
    if (carritoInfo.items.length === 0) {
      return res.status(400).json({ error: 'Tu carrito está vacío.' });
    }

    for (const item of carritoInfo.items) {
      const art = queryOne('SELECT stock, nombre FROM articulos WHERE id = ?', [item.articulo_id]);
      if (!art || art.stock < item.cantidad) {
        return res.status(400).json({
          error: `Stock insuficiente para "${item.nombre}".`
        });
      }
    }

    for (const item of carritoInfo.items) {
      execute('UPDATE articulos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.articulo_id]);
    }

    execute("UPDATE carritos SET estado = 'completado' WHERE id = ?", [carritoInfo.carritoId]);
    const pedidoId = execute(
      'INSERT INTO pedidos (usuario_id, carrito_id, total_pagado) VALUES (?, ?, ?)',
      [Number(usuarioId), carritoInfo.carritoId, carritoInfo.totalPagar]
    );
    execute('INSERT INTO carritos (usuario_id, estado) VALUES (?, ?)', [Number(usuarioId), 'activo']);

    res.json({
      mensaje: '¡Pedido confirmado exitosamente!',
      pedidoId,
      totalPagado: carritoInfo.totalPagar
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el pedido.' });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error iniciando la base de datos:', err);
  });