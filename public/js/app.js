cat << 'EOF' > public/js/app.js
const state = {
  usuario: JSON.parse(localStorage.getItem('tsp_usuario') || 'null'),
  articulos: []
};

const els = {
  inputBusquedaNombre: document.getElementById('inputBusquedaNombre'),
  btnLimpiarFiltros: document.getElementById('btnLimpiarFiltros'),
  selectCategoria: document.getElementById('selectCategoria'),
  inputPrecioMin: document.getElementById('inputPrecioMin'),
  inputPrecioMax: document.getElementById('inputPrecioMax'),
  checkSoloDisponibles: document.getElementById('checkSoloDisponibles'),
  gridArticulos: document.getElementById('gridArticulos'),
  contadorArticulos: document.getElementById('contadorArticulos'),
  authBox: document.getElementById('authBox'),
  userBox: document.getElementById('userBox'),
  nombreUsuarioLabel: document.getElementById('nombreUsuarioLabel'),
  btnAbrirAuth: document.getElementById('btnAbrirAuth'),
  btnLogout: document.getElementById('btnLogout'),
  modalAuth: document.getElementById('modalAuth'),
  btnCerrarAuth: document.getElementById('btnCerrarAuth'),
  tabLogin: document.getElementById('tabLogin'),
  tabRegistro: document.getElementById('tabRegistro'),
  formLogin: document.getElementById('formLogin'),
  formRegistro: document.getElementById('formRegistro'),
  authMensaje: document.getElementById('authMensaje'),
  modalDetalle: document.getElementById('modalDetalle'),
  btnCerrarModal: document.getElementById('btnCerrarModal'),
  modalImagen: document.getElementById('modalImagen'),
  modalCategoria: document.getElementById('modalCategoria'),
  modalNombre: document.getElementById('modalNombre'),
  modalDescripcion: document.getElementById('modalDescripcion'),
  modalPrecio: document.getElementById('modalPrecio'),
  modalStock: document.getElementById('modalStock'),
  carritoContenido: document.getElementById('carritoContenido'),
  carritoTotalCantidad: document.getElementById('carritoTotalCantidad'),
  carritoTotalPagar: document.getElementById('carritoTotalPagar'),
  btnConfirmarPedido: document.getElementById('btnConfirmarPedido'),
  toast: document.getElementById('toast')
};

function formatoCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(valor);
}

function mostrarToast(mensaje) {
  els.toast.textContent = mensaje;
  els.toast.classList.remove('hidden');
  clearTimeout(mostrarToast._timer);
  mostrarToast._timer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2800);
}

function generarPlaceholderSvg(articulo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#eff6ff"/>
    <text x="200" y="135" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#1e3a8a" text-anchor="middle">${articulo.categoria}</text>
    <text x="200" y="170" font-family="Arial, sans-serif" font-size="14" fill="#475569" text-anchor="middle">SKU #${String(articulo.id).padStart(2, '0')} – TechShop TSPi</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function cargarArticulos() {
  const params = new URLSearchParams();
  if (els.inputBusquedaNombre.value.trim()) params.set('q', els.inputBusquedaNombre.value.trim());
  if (els.selectCategoria.value !== 'todas') params.set('categoria', els.selectCategoria.value);
  if (els.inputPrecioMin.value !== '') params.set('precioMin', els.inputPrecioMin.value);
  if (els.inputPrecioMax.value !== '') params.set('precioMax', els.inputPrecioMax.value);
  if (els.checkSoloDisponibles.checked) params.set('soloDisponibles', 'true');

  const res = await fetch(`/api/articulos?${params.toString()}`);
  const data = await res.json();
  state.articulos = data;
  renderArticulos();
}

function renderArticulos() {
  els.contadorArticulos.textContent = `${state.articulos.length} artículos`;

  if (state.articulos.length === 0) {
    els.gridArticulos.innerHTML = `<p class="muted">No se encontraron artículos con los filtros seleccionados.</p>`;
    return;
  }

  els.gridArticulos.innerHTML = state.articulos
    .map((art) => {
      const sinStock = art.stock <= 0;
      return `
        <article class="card-articulo">
          <div class="thumb-box" data-id="${art.id}" title="Clic para ampliar detalles">
            <div class="thumb-code">#${String(art.id).padStart(2, '0')}</div>
            <div class="thumb-cat">${art.categoria}</div>
            <span class="thumb-hint">Clic para ampliar</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${art.nombre}</h3>
            <div class="card-meta">
              <span class="price">${formatoCOP(art.precio)}</span>
              <span class="${sinStock ? 'stock-out' : 'stock-ok'}">
                ${sinStock ? 'Agotado' : `Stock: ${art.stock}`}
              </span>
            </div>
            <div class="buy-row">
              <input
                type="number"
                min="1"
                max="${Math.max(1, art.stock)}"
                value="1"
                id="cant-${art.id}"
                ${sinStock ? 'disabled' : ''}
              />
              <button
                type="button"
                class="btn btn-primary btn-agregar"
                data-id="${art.id}"
                ${sinStock ? 'disabled' : ''}
              >
                Agregar
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('.thumb-box').forEach((box) => {
    box.addEventListener('click', () => abrirDetalleArticulo(Number(box.dataset.id)));
  });

  document.querySelectorAll('.btn-agregar').forEach((btn) => {
    btn.addEventListener('click', () => agregarAlCarrito(Number(btn.dataset.id)));
  });
}

function abrirDetalleArticulo(id) {
  const art = state.articulos.find((a) => a.id === id);
  if (!art) return;

  els.modalImagen.src = generarPlaceholderSvg(art);
  els.modalImagen.alt = art.nombre;
  els.modalCategoria.textContent = art.categoria;
  els.modalNombre.textContent = art.nombre;
  els.modalDescripcion.textContent = art.descripcion;
  els.modalPrecio.textContent = formatoCOP(art.precio);
  els.modalStock.textContent =
    art.stock > 0 ? `Disponibles en inventario: ${art.stock} unidades` : 'Producto agotado (Stock: 0)';
  els.modalDetalle.classList.remove('hidden');
}

function actualizarUIUsuario() {
  if (state.usuario) {
    els.authBox.classList.add('hidden');
    els.userBox.classList.remove('hidden');
    els.nombreUsuarioLabel.textContent = `Hola, ${state.usuario.nombre}`;
    cargarCarrito();
  } else {
    els.authBox.classList.remove('hidden');
    els.userBox.classList.add('hidden');
    els.carritoContenido.innerHTML = `<p class="muted">Inicia sesión o regístrate para agregar productos y ver tu carrito.</p>`;
    els.carritoTotalCantidad.textContent = '0';
    els.carritoTotalPagar.textContent = formatoCOP(0);
    els.btnConfirmarPedido.disabled = true;
  }
}

async function cargarCarrito() {
  if (!state.usuario) return;
  const res = await fetch(`/api/carrito/${state.usuario.id}`);
  const data = await res.json();
  renderCarrito(data);
}

function renderCarrito(data) {
  els.carritoTotalCantidad.textContent = data.totalCantidad;
  els.carritoTotalPagar.textContent = formatoCOP(data.totalPagar);
  els.btnConfirmarPedido.disabled = data.items.length === 0;

  if (!data.items || data.items.length === 0) {
    els.carritoContenido.innerHTML = `<p class="muted">Tu carrito está vacío.</p>`;
    return;
  }

  els.carritoContenido.innerHTML = data.items
    .map(
      (item) => `
      <div class="cart-item">
        <div class="cart-item-top">
          <span>${item.nombre}</span>
          <button type="button" class="btn btn-danger btn-quitar" data-id="${item.id}">Quitar</button>
        </div>
        <div class="cart-item-bottom">
          <span>${item.cantidad} × ${formatoCOP(item.precio_unitario)}</span>
          <strong>${formatoCOP(item.subtotal)}</strong>
        </div>
      </div>
    `
    )
    .join('');

  document.querySelectorAll('.btn-quitar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const res = await fetch(`/api/carrito/item/${btn.dataset.id}?usuarioId=${state.usuario.id}`, {
        method: 'DELETE'
      });
      const actualizado = await res.json();
      renderCarrito(actualizado);
      mostrarToast('Artículo eliminado del carrito.');
    });
  });
}

async function agregarAlCarrito(articuloId) {
  if (!state.usuario) {
    mostrarToast('Debes iniciar sesión para realizar compras.');
    els.modalAuth.classList.remove('hidden');
    return;
  }

  const inputCant = document.getElementById(`cant-${articuloId}`);
  const cantidad = Number(inputCant ? inputCant.value : 1);

  const res = await fetch('/api/carrito/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuarioId: state.usuario.id,
      articuloId,
      cantidad
    })
  });

  const data = await res.json();
  if (!res.ok) {
    mostrarToast(data.error || 'No se pudo agregar al carrito.');
    return;
  }

  renderCarrito(data);
  mostrarToast('Artículo agregado al carrito.');
}

// Eventos de filtros
[els.inputBusquedaNombre, els.selectCategoria, els.inputPrecioMin, els.inputPrecioMax, els.checkSoloDisponibles].forEach(
  (el) => {
    el.addEventListener('input', cargarArticulos);
    el.addEventListener('change', cargarArticulos);
  }
);

els.btnLimpiarFiltros.addEventListener('click', () => {
  els.inputBusquedaNombre.value = '';
  els.selectCategoria.value = 'todas';
  els.inputPrecioMin.value = '';
  els.inputPrecioMax.value = '';
  els.checkSoloDisponibles.checked = false;
  cargarArticulos();
});

// Eventos modales
els.btnCerrarModal.addEventListener('click', () => els.modalDetalle.classList.add('hidden'));
els.modalDetalle.addEventListener('click', (e) => {
  if (e.target === els.modalDetalle) els.modalDetalle.classList.add('hidden');
});

els.btnAbrirAuth.addEventListener('click', () => {
  els.authMensaje.textContent = '';
  els.modalAuth.classList.remove('hidden');
});

els.btnCerrarAuth.addEventListener('click', () => els.modalAuth.classList.add('hidden'));
els.modalAuth.addEventListener('click', (e) => {
  if (e.target === els.modalAuth) els.modalAuth.classList.add('hidden');
});

els.tabLogin.addEventListener('click', () => {
  els.tabLogin.classList.add('active');
  els.tabRegistro.classList.remove('active');
  els.formLogin.classList.remove('hidden');
  els.formRegistro.classList.add('hidden');
  els.authMensaje.textContent = '';
});

els.tabRegistro.addEventListener('click', () => {
  els.tabRegistro.classList.add('active');
  els.tabLogin.classList.remove('active');
  els.formRegistro.classList.remove('hidden');
  els.formLogin.classList.add('hidden');
  els.authMensaje.textContent = '';
});

els.formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    })
  });
  const data = await res.json();
  if (!res.ok) {
    els.authMensaje.textContent = data.error;
    return;
  }
  state.usuario = data.usuario;
  localStorage.setItem('tsp_usuario', JSON.stringify(data.usuario));
  els.modalAuth.classList.add('hidden');
  actualizarUIUsuario();
  mostrarToast(`Bienvenido, ${data.usuario.nombre}`);
});

els.formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: document.getElementById('regNombre').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value
    })
  });
  const data = await res.json();
  if (!res.ok) {
    els.authMensaje.textContent = data.error;
    return;
  }
  state.usuario = data.usuario;
  localStorage.setItem('tsp_usuario', JSON.stringify(data.usuario));
  els.modalAuth.classList.add('hidden');
  actualizarUIUsuario();
  mostrarToast(`Cuenta creada para ${data.usuario.nombre}`);
});

els.btnLogout.addEventListener('click', () => {
  state.usuario = null;
  localStorage.removeItem('tsp_usuario');
  actualizarUIUsuario();
  mostrarToast('Sesión cerrada.');
});

els.btnConfirmarPedido.addEventListener('click', async () => {
  if (!state.usuario) return;
  const res = await fetch('/api/pedidos/confirmar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId: state.usuario.id })
  });
  const data = await res.json();
  if (!res.ok) {
    mostrarToast(data.error || 'No se pudo confirmar el pedido.');
    return;
  }
  mostrarToast(`${data.mensaje} Total: ${formatoCOP(data.totalPagado)}`);
  await Promise.all([cargarArticulos(), cargarCarrito()]);
});

// Arranque inicial
actualizarUIUsuario();
cargarArticulos();
EOF