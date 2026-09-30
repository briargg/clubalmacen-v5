// ============================================
// CLUBALMACÉN V5 – directorio.js
// Código QR + buscador de comercios (para el cliente)
// ============================================
//
// CORREGIDO POR COMPLETO: la versión anterior de este archivo inventaba un
// campo propio (`aliasBusqueda`) con su propia función de guardado
// (guardarAliasBusqueda) y su propio buscador (buscarUsuario) — sin saber
// que wallet.js YA tiene un sistema real y completo para esto:
// `nombreUsuario`/`nombreDisplay` (guardados desde "Mi Perfil", con
// guardarNombreUsuario) y una función de búsqueda genérica ya armada
// (buscarUsuarios(query, rol)), que además ya usa el comerciante en la
// pestaña "Clientes" (renderBuscadorClientes). Tener dos campos distintos
// para lo mismo (aliasBusqueda vs nombreUsuario) iba a significar que la
// mitad de los usuarios fueran buscables por un sistema y la otra mitad
// por el otro, sin cruzarse nunca.
//
// Lo que este archivo aporta de verdad, que no está en wallet.js:
//   1. El buscador en la DIRECCIÓN QUE FALTABA — wallet.js solo tiene
//      "comerciante busca cliente" (renderBuscadorClientes). Acá está
//      "cliente busca comercio" (renderBuscadorComercios), reusando la
//      misma buscarUsuarios() de wallet.js con rol='comerciante'.
//   2. Código QR de perfil (mostrarQR / mostrarMiQR) + deep link.
//
// REQUIERE (agregar antes de este script en el HTML, y wallet.js debe
// cargar ANTES que este archivo porque usa buscarUsuarios de ahí):
//   <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
//
// HTML sugerido para que el cliente busque comercios (por ejemplo arriba
// de la grilla de "Tiendas", junto a #tiendasGrid):
//   <div id="buscadorComerciosContainer"></div>
// y llamar renderBuscadorComercios() al abrir esa pestaña (switchTab,
// acción 'cliente-tiendas').

// ============================================
// BUSCADOR DE COMERCIOS (cliente)
// ============================================

function renderBuscadorComercios() {
    const container = document.getElementById('buscadorComerciosContainer');
    if (!container) return;
    container.innerHTML = `
    <div style="position:relative;margin-bottom:16px">
        <input type="text" id="buscarComercioInput" class="form-control"
            placeholder="🔍 Buscar tu comercio por @usuario, nombre o email..."
            oninput="buscarComercioDebounced()">
        <div id="buscarComercioResultados" style="margin-top:10px"></div>
    </div>`;
}

let _buscarComercioTimeout = null;
function buscarComercioDebounced() {
    clearTimeout(_buscarComercioTimeout);
    _buscarComercioTimeout = setTimeout(ejecutarBusquedaComercio, 350);
}

async function ejecutarBusquedaComercio() {
    const input = document.getElementById('buscarComercioInput');
    const res   = document.getElementById('buscarComercioResultados');
    if (!input || !res) return;
    const q = input.value.trim();
    if (q.length < 2) { res.innerHTML = ''; return; }

    res.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';

    if (typeof buscarUsuarios !== 'function') {
        // wallet.js todavía no cargó, o no está incluido en esta página.
        res.innerHTML = '<div class="no-items">Buscador no disponible</div>';
        return;
    }

    const comercios = await buscarUsuarios(q, 'comerciante');
    if (comercios.length === 0) { res.innerHTML = '<div class="no-items">Sin resultados</div>'; return; }

    const me = firebase.auth().currentUser;

    res.innerHTML = comercios.map(u => {
        const nombre = u.nombreDisplay || u.email || 'Comercio';
        return `
        <div class="purchase-item" id="resultadoComercio_${u.id}">
            <div class="purchase-info">
                <h4>${nombre}</h4>
                <p style="font-size:12px;color:var(--text-light)">🏪 @${u.nombreUsuario||'?'} · ${u.email||''}</p>
                <p id="fiadoBadge_${u.id}" style="font-size:11px;color:var(--success);display:none;margin-top:2px">
                    💳 Tenés fiado habilitado acá
                </p>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
                <button class="btn btn-primary" style="font-size:11px;padding:6px 10px"
                    onclick="abrirTiendaOFallback('${u.id}','${nombre.replace(/'/g,"\\'")}')">
                    <i class="fas fa-store"></i> Comprar
                </button>
                <button class="btn btn-outline" style="font-size:11px;padding:6px 10px"
                    onclick="mostrarQR('${u.id}','${nombre.replace(/'/g,"\\'")}')">
                    <i class="fas fa-qrcode"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    // Si el cliente ya tiene fiado habilitado con alguno de estos comercios,
    // mostrar el badge — esto es lo que permite "encontrar en el buscador a
    // tu comercio que te da el fiado".
    if (me) {
        comercios.forEach(u => {
            db.collection(COL.USERS).doc(u.id).collection(COL.FIADOS).doc(me.uid).get()
                .then(fDoc => {
                    if (fDoc.exists && fDoc.data()?.activo) {
                        document.getElementById(`fiadoBadge_${u.id}`)?.style.setProperty('display','block');
                    }
                })
                .catch(() => {}); // silencioso: si no hay permiso o no existe, no pasa nada
        });
    }
}

// ============================================
// CÓDIGO QR
// ============================================

function mostrarMiQR() {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión','warning'); return; }
    mostrarQR(user.uid, user.email);
}

function mostrarQR(userId, nombre) {
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) return;
    const link = `${location.origin}${location.pathname}?perfil=${userId}`;

    overlay.innerHTML = `
    <div class="modal-content" style="max-width:340px;width:90%;text-align:center">
        <h3 style="font-weight:800;margin-bottom:6px">${nombre||'Mi código QR'}</h3>
        <p style="font-size:12px;color:var(--text-light);margin-bottom:16px">
            Mostrá este código para que te encuentren en Club Almacén
        </p>
        <div id="qrCanvas" style="display:flex;justify-content:center;margin-bottom:16px"></div>
        <input type="text" class="form-control" value="${link}" readonly
            style="text-align:center;font-size:11px;margin-bottom:14px" onclick="this.select()">
        <button class="btn btn-outline" style="width:100%"
            onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none'">Cerrar</button>
    </div>`;
    overlay.style.display = 'flex';

    const canvas = document.getElementById('qrCanvas');
    if (typeof QRCode !== 'undefined' && canvas) {
        new QRCode(canvas, { text: link, width:180, height:180, colorDark:'#000', colorLight:'#fff' });
    } else if (canvas) {
        // Fallback si la librería QRCode no cargó (por ejemplo sin internet):
        // usamos un servicio público de generación de QR como imagen.
        canvas.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}"
            width="180" height="180" alt="QR">`;
    }
}

// Detecta ?perfil=UID en la URL y abre la ficha de ese usuario (deep link del QR)
function checkPerfilDeepLink() {
    const uid = new URLSearchParams(location.search).get('perfil');
    if (!uid) return;
    auth.onAuthStateChanged(async user => {
        if (!user) return;
        try {
            const doc = await db.collection(COL.USERS).doc(uid).get();
            if (!doc.exists) { showToast('Usuario no encontrado','warning'); return; }
            const u = doc.data();
            showToast(`👤 ${u.nombreDisplay || u.email} · ${u.role==='comerciante'?'Comercio':'Cliente'}`, 'info', 6000);
        } catch(e) { console.error('checkPerfilDeepLink:', e); }
    });
}

// ============================================
// INIT
// ============================================

function initDirectorio() {
    renderBuscadorComercios();
    checkPerfilDeepLink();
}

// ============================================
// EXPORTS
// ============================================
window.renderBuscadorComercios   = renderBuscadorComercios;
window.buscarComercioDebounced   = buscarComercioDebounced;
window.ejecutarBusquedaComercio  = ejecutarBusquedaComercio;
window.mostrarMiQR               = mostrarMiQR;
window.mostrarQR                 = mostrarQR;
window.checkPerfilDeepLink       = checkPerfilDeepLink;
window.initDirectorio            = initDirectorio;

console.log('✅ directorio.js cargado (buscador de comercios + QR — reusa wallet.js)');