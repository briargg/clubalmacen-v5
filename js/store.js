// ============================================
// CLUBALMACÉN – store.js (Tienda + Catálogo del Comerciante)
// ============================================

window.Store = window.Store || { carrito: [] };
let carritoActual = [];

// ============================================
// 1. TIENDA PARA EL CLIENTE
// ============================================

async function loadTiendasParaCliente() {
    const container = document.getElementById('tiendasGrid');
    if (!container) return;
    
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light)"><i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary)"></i><p style="margin-top:10px">Cargando comercios...</p></div>`;

    try {
        const snap = await db.collection(COL.PERFILES_COMERCIOS).where('activo', '==', true).get();
        let tiendas = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.nombre);

        if (tiendas.length === 0) {
            const snap2 = await db.collection(COL.PERFILES_COMERCIOS).where('nombre', '!=', '').get();
            tiendas = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (tiendas.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)"><p>Aún no hay comercios disponibles.</p></div>`;
            return;
        }

        container.innerHTML = '';
        tiendas.forEach(t => {
            const card = document.createElement('div');
            card.className = 'tienda-card';
            card.innerHTML = `
                <div class="tienda-card-cover">${t.cover ? `<img src="${t.cover}">` : `<div style="background:linear-gradient(135deg,#e0e0e0,#f5f5f5);height:120px;display:flex;align-items:center;justify-content:center;font-size:40px">🏪</div>`}</div>
                <div class="tienda-card-body">
                    <div class="tienda-card-logo">${t.logo ? `<img src="${t.logo}">` : '🏪'}</div>
                    <div class="tienda-card-info">
                        <h4>${t.nombre}</h4>
                        <p>${t.tipo || 'Comercio'}</p>
                    </div>
                </div>`;
            
            card.addEventListener('click', () => {
                if (typeof window.abrirTienda === 'function') window.abrirTienda(t.id);
            });
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error al cargar tiendas:", e);
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)"><p>Error al cargar comercios.</p></div>`;
    }
}

async function abrirTienda(tiendaId) {
    const panel = document.getElementById('tiendaPanel');
    if (!panel) return;

    document.getElementById('tiendasListaView').style.display = 'none';
    panel.style.display = 'block';
    panel.innerHTML = `<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary)"></i><p>Cargando tienda...</p></div>`;

    try {
        const [perfilDoc, ofertasSnap] = await Promise.all([
            db.collection(COL.PERFILES_COMERCIOS).doc(tiendaId).get(),
            db.collection(COL.PERFILES_COMERCIOS).doc(tiendaId).collection(COL.OFERTAS).where('activo', '==', true).get()
        ]);

        if (!perfilDoc.exists) {
            panel.innerHTML = '<p>Comercio no encontrado.</p>';
            return;
        }

        const t = { id: tiendaId, ...perfilDoc.data() };
        const ofertas = ofertasSnap.docs.map(d => ({ id: d.id, comercianteId: tiendaId, ...d.data() }));

        panel.innerHTML = `
        <button onclick="cerrarTienda()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--primary);font-weight:700;font-size:14px;cursor:pointer;margin-bottom:14px;padding:0"><i class="fas fa-arrow-left"></i> Volver a comercios</button>
        <div class="tienda-header" style="background: linear-gradient(135deg, #a00000, #e00000); color: white; padding: 20px; border-radius: 12px; margin-bottom:16px;">
            <h3 style="color:white;margin:0;font-size:20px;">${t.nombre}</h3>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${t.tipo || ''}</p>
        </div>
        <div class="productos-grid" id="productosGrid" style="padding-bottom:100px;"></div>`;

        const grid = document.getElementById('productosGrid');
        
        if (ofertas.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light)"><p>Este comercio aún no publicó productos.</p></div>';
            return;
        }

        ofertas.forEach(o => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.innerHTML = `
                <div class="producto-img">${o.imagen ? `<img src="${o.imagen}">` : '📦'}</div>
                <div class="producto-body">
                    <div class="producto-nombre">${o.nombre}</div>
                    <div class="producto-precio-row"><span class="producto-precio">$${parseFloat(o.precio).toLocaleString('es-AR')}</span></div>
                    <button class="producto-add-btn" onclick="agregarAlCarrito('${o.id}', '${o.nombre.replace(/'/g,"\\'")}', ${o.precio}, '${tiendaId}')"><i class="fas fa-cart-plus"></i> Agregar</button>
                </div>`;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        panel.innerHTML = '<p style="padding:20px;color:var(--primary)">Error al cargar la tienda.</p>';
    }
}

function cerrarTienda() {
    document.getElementById('tiendaPanel').style.display = 'none';
    document.getElementById('tiendasListaView').style.display = 'block';
}

// ============================================
// 2. LÓGICA DEL CARRITO
// ============================================

window.agregarAlCarrito = function(id, nombre, precio, comercianteId) {
    // Si el carrito tiene productos de otro comercio, lo vaciamos para no mezclar
    if (carritoActual.length > 0 && carritoActual[0].comercianteId !== comercianteId) {
        if (!confirm('Tu carrito tiene productos de otro comercio. ¿Querés vaciarlo para agregar este?')) return;
        carritoActual = [];
    }

    const existente = carritoActual.find(p => p.id === id);
    if (existente) {
        existente.quantity += 1;
    } else {
        carritoActual.push({ id, nombre, precio, comercianteId, quantity: 1 });
    }
    
    showToast(`✅ ${nombre} agregado`, 'success', 2000);
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    const flotante = document.getElementById('carritoFlotante');
    const totalEl  = document.getElementById('carritoTotalFlotante');
    
    if (carritoActual.length === 0) {
        if (flotante) flotante.style.display = 'none';
        return;
    }

    const total = carritoActual.reduce((acc, p) => acc + (p.precio * p.quantity), 0);
    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;
    if (flotante) flotante.style.display = 'flex';
}

window.abrirModalPagoCarrito = async function() {
    if (carritoActual.length === 0) return;
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión', 'warning'); return; }

    const comercianteId = carritoActual[0].comercianteId;
    const total = carritoActual.reduce((acc, p) => acc + (p.precio * p.quantity), 0);

    // Verificamos fiado
    let tieneFiado = false;
    try {
        const doc = await db.collection(COL.USERS).doc(comercianteId).collection(COL.FIADOS).doc(user.uid).get();
        tieneFiado = doc.exists && (doc.data().monto_fiado || 0) > 0;
    } catch(e) {}

    let modal = document.getElementById('productoModalOverlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'productoModalOverlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;justify-content:center;align-items:flex-end;z-index:1050;backdrop-filter:blur(3px)';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    modal.innerHTML = `
    <div class="producto-modal" style="background:white; width:100%; max-width:500px; border-radius:24px 24px 0 0; padding:24px;">
        <h2 style="font-size:20px; font-weight:800; margin-bottom:16px;">Finalizar Compra</h2>
        <div style="max-height:150px; overflow-y:auto; margin-bottom:16px; background:#f8f8f8; padding:12px; border-radius:12px;">
            ${carritoActual.map(p => `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px"><span>${p.quantity}x ${p.nombre}</span><strong>$${(p.precio * p.quantity).toLocaleString('es-AR')}</strong></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <span style="font-size:16px;font-weight:700;">Total:</span>
            <span style="font-size:24px;font-weight:800;color:var(--primary)">$${total.toLocaleString('es-AR')}</span>
        </div>
        
        <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px">
            <div style="font-weight:700;margin-bottom:12px;font-size:15px">¿Cómo querés comprar?</div>
            ${tieneFiado ? `
                <button class="btn btn-primary" onclick="confirmarCompraCarrito('${comercianteId}', ${total}, 'fiado')" style="width:100%;margin-bottom:10px;padding:14px;">
                    📋 Comprar con fiado
                </button>
            ` : `<div style="font-size:12px;color:var(--text-light);margin-bottom:10px;text-align:center;">Sin fiado habilitado en este comercio</div>`}
            <button class="btn btn-secondary" onclick="confirmarCompraCarrito('${comercianteId}', ${total}, 'pagar')" style="width:100%;padding:14px;">
                💳 Pagar ahora (Efectivo/Transf/MP)
            </button>
        </div>
        <button class="btn btn-outline" onclick="document.getElementById('productoModalOverlay').style.display='none'" style="width:100%;padding:12px">
            Seguir comprando
        </button>
    </div>`;
}

async function confirmarCompraCarrito(comercianteId, total, tipoCompra) {
    const user = firebase.auth().currentUser;
    document.getElementById('productoModalOverlay').style.display = 'none';

    try {
        const items = carritoActual.map(p => ({ name: p.nombre, quantity: p.quantity, price: p.precio, total: p.precio * p.quantity }));

        const purchaseRef = await db.collection(COL.PURCHASES).add({
            clienteId: user.uid, clienteEmail: user.email,
            comercianteId: comercianteId, total: total, items: items,
            category: tipoCompra === 'fiado' ? 'tienda-fiado' : 'tienda-pago',
            status: 'pending', paid: false, origen: 'manual', createdAt: now()
        });

        carritoActual = [];
        actualizarCarritoUI();

        if (tipoCompra === 'fiado') {
            if (typeof mostrarExitoCompra === 'function') {
                mostrarExitoCompra('¡Pedido Enviado!', 'El comercio revisará tu pedido por fiado.', '✅');
            } else {
                showToast('✅ Pedido por fiado enviado.', 'success');
            }
        } else {
            showToast('Compra generada. Seleccioná el método de pago.', 'success');
            window._compraRecienteId = purchaseRef.id;

            if (typeof window.openPaymentModal === 'function') {
                await window.openPaymentModal();
                
                // Forzamos a que el modal de pago seleccione ESTA compra específica
                setTimeout(() => {
                    const select = document.getElementById('purchaseToPaySelect');
                    if (select) {
                        select.innerHTML = `<option value="${purchaseRef.id}" data-total="${total}" data-comerciante-id="${comercianteId}">$${total.toFixed(2)} – tienda-pago</option>`;
                        select.value = purchaseRef.id;
                        select.dispatchEvent(new Event('change'));
                    }
                }, 300);
            }
        }
    } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
}

// ============================================
// 3. CATÁLOGO DEL COMERCIANTE (Lo que faltaba)
// ============================================

window.loadOfertasComerciante = async function(uid) {
    const container = document.getElementById('ofertasAdminList');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    
    try {
        const snap = await db.collection(COL.PERFILES_COMERCIOS).doc(uid).collection(COL.OFERTAS).get();
        if (snap.empty) {
            container.innerHTML = '<div class="no-items">No tenés productos publicados aún.</div>';
            return;
        }
        container.innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            return `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${o.nombre}</h4>
                    <p>$${parseFloat(o.precio).toFixed(2)}</p>
                </div>
                <button class="btn btn-outline" onclick="db.collection('${COL.PERFILES_COMERCIOS}').doc('${uid}').collection('${COL.OFERTAS}').doc('${doc.id}').delete().then(()=>loadOfertasComerciante('${uid}'))" style="font-size:12px;padding:4px 8px;color:var(--primary)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="no-items">Error: ${e.message}</div>`;
    }
};

window.showOfertaForm = function() {
    const container = document.getElementById('ofertaFormContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="background:#f8f8f8;padding:16px;border-radius:12px;margin-bottom:16px;">
            <h3 style="margin-top:0;font-size:16px;">Nuevo Producto</h3>
            <div class="form-group">
                <label class="form-label">Nombre</label>
                <input type="text" id="ofertaNombre" class="form-control" placeholder="Ej: Cerveza Quilmes 1L">
            </div>
            <div class="form-group">
                <label class="form-label">Precio ($)</label>
                <input type="number" id="ofertaPrecio" class="form-control" placeholder="1500">
            </div>
            <div class="form-group">
                <label class="form-label">Imagen del producto (URL)</label>
                <input type="text" id="ofertaImagen" class="form-control" placeholder="https://...">
            </div>
            <div class="form-group">
                <label class="form-label">Descripción breve</label>
                <input type="text" id="ofertaDesc" class="form-control" placeholder="Ej: Pack x6">
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-primary" onclick="window.guardarNuevaOferta()" style="flex:1">Guardar</button>
                <button class="btn btn-outline" onclick="document.getElementById('ofertaFormContainer').innerHTML=''" style="flex:1">Cancelar</button>
            </div>
        </div>
    `;
};

window.guardarNuevaOferta = async function() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const nombre = document.getElementById('ofertaNombre').value.trim();
    const precio = parseFloat(document.getElementById('ofertaPrecio').value);
    const imagen = document.getElementById('ofertaImagen').value.trim();
    const desc = document.getElementById('ofertaDesc').value.trim();

    if (!nombre || !precio) {
        showToast('Completá el nombre y el precio', 'warning');
        return;
    }

    try {
        await db.collection(COL.PERFILES_COMERCIOS).doc(user.uid).collection(COL.OFERTAS).add({
            nombre: nombre, precio: precio, imagen: imagen, descripcion: desc,
            activo: true, categoria: 'General', createdAt: now()
        });
        showToast('✅ Producto guardado', 'success');
        document.getElementById('ofertaFormContainer').innerHTML = '';
        loadOfertasComerciante(user.uid);
    } catch(e) {
        showToast(`Error: ${e.message}`, 'error');
    }
};

// ============================================
// EXPORTS GLOBALES
// ============================================
window.loadTiendasParaCliente = loadTiendasParaCliente;
window.abrirTienda = abrirTienda;
window.cerrarTienda = cerrarTienda;

console.log('✅ store.js cargado (Tienda + Carrito + Catálogo Comerciante)');