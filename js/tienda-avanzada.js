// ============================================
// CLUBALMACÉN V5 – tienda-avanzada.js
// ============================================

async function abrirProductoParaComprar(producto) {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para comprar', 'warning'); return; }

    // Verificamos fiado
    let tieneFiado = false;
    try {
        const doc = await db.collection(COL.USERS).doc(producto.comercianteId).collection(COL.FIADOS).doc(user.uid).get();
        tieneFiado = doc.exists && (doc.data().monto_fiado || 0) > 0;
    } catch(e) { tieneFiado = false; }
    
    let modal = document.getElementById('productoModalOverlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'productoModalOverlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;justify-content:center;align-items:flex-end;z-index:1050;backdrop-filter:blur(3px)';
        modal.onclick = (e) => { if(e.target === modal) cerrarProductoModal(); };
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    modal.innerHTML = `
    <div class="producto-modal" style="background:white; width:100%; max-width:500px; border-radius:24px 24px 0 0; padding:24px; animation:slideUp 0.3s ease;">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span style="font-size:12px;font-weight:700;color:var(--text-light)">${producto.categoria||'Producto'}</span>
            <button onclick="cerrarProductoModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
        </div>
        <div style="text-align:center; margin-bottom:16px;">
            ${producto.imagen ? `<img src="${producto.imagen}" style="max-height:150px; border-radius:12px; object-fit:cover;">` : '<span style="font-size:60px;">📦</span>'}
        </div>
        <h2 style="font-size:22px; font-weight:800; margin-bottom:8px;">${producto.nombre}</h2>
        <p style="color:var(--text-light); font-size:14px; margin-bottom:16px;">${producto.descripcion||''}</p>
        <div style="font-size:24px; font-weight:800; color:var(--primary); margin-bottom:20px;">
            $${parseFloat(producto.precio).toLocaleString('es-AR')}
        </div>
        
        <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px">
            <div style="font-weight:700;margin-bottom:12px;font-size:15px">¿Cómo querés comprar?</div>
            
            ${tieneFiado ? `
                <button class="btn btn-primary" onclick="comprarDesdeTienda('${producto.comercianteId}', '${producto.nombre}', ${producto.precio}, 'fiado')" style="width:100%;margin-bottom:10px;padding:14px;font-size:15px">
                    📋 Comprar con fiado
                </button>
            ` : `<div style="font-size:12px;color:var(--text-light);margin-bottom:10px;text-align:center;background:#fff3e0;padding:8px;border-radius:8px;">Sin fiado habilitado en este comercio</div>`}
            
            <button class="btn btn-secondary" onclick="comprarDesdeTienda('${producto.comercianteId}', '${producto.nombre}', ${producto.precio}, 'pagar')" style="width:100%;padding:14px;font-size:15px">
                💳 Pagar ahora (Efectivo/Transf/MP)
            </button>
        </div>
        
        <button class="btn btn-outline" onclick="compartirProducto('${producto.id}','${producto.nombre}','${producto.comercianteId}')" style="width:100%;padding:12px">
            <i class="fas fa-share-alt"></i> Compartir producto
        </button>
    </div>
    <style>@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }</style>`;
}

function cerrarProductoModal() {
    const modal = document.getElementById('productoModalOverlay');
    if (modal) modal.style.display = 'none';
}

async function comprarDesdeTienda(comercianteId, nombre, precio, tipoCompra) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    cerrarProductoModal();

    if (typeof window.comprarDesdeTiendaDirecto === 'function') {
        await window.comprarDesdeTiendaDirecto(comercianteId, nombre, precio, tipoCompra);
    } else {
        showToast('Error: Módulo de compras no disponible.', 'error');
    }
}

function compartirProducto(productoId, productoNombre, comercianteId) {
    const link = `${location.origin}${location.pathname}?producto=${productoId}&comercio=${comercianteId}`;
    const texto = `¡Comprá ${productoNombre} en Club Almacén y sumá puntos que canjeás por electrodomésticos! 🎁\n${link}`;
    
    if (navigator.share) {
        navigator.share({ title: 'Club Almacén', text: texto, url: link }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(texto).then(() => showToast('Link copiado ✅', 'success'));
    }
}

function checkProductoDeepLink() {
    const productoId = new URLSearchParams(location.search).get('producto');
    const comercioId = new URLSearchParams(location.search).get('comercio');
    
    if (!productoId || !comercioId) return;
    
    auth.onAuthStateChanged(user => {
        if (!user) {
            showToast('¡Registrate para comprar este producto y sumar puntos!', 'info', 6000);
        } else {
            setTimeout(() => {
                if (typeof abrirTienda === 'function') abrirTienda(comercioId);
            }, 1500);
        }
    });
}

window.abrirProductoParaComprar = abrirProductoParaComprar;
window.cerrarProductoModal = cerrarProductoModal;
window.comprarDesdeTienda = comprarDesdeTienda;
window.compartirProducto = compartirProducto;
window.checkProductoDeepLink = checkProductoDeepLink;

console.log('✅ tienda-avanzada.js cargado correctamente');