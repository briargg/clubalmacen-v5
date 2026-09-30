// CLUBALMACÉN V5 – wallet.js

// ELIMINADA LA DECLARACIÓN DUPLICADA DE ALIAS_CLUB_ALMACEN

function pagarConMercadoPago(alias, monto, concepto) {
    if (!alias) { showToast('El comerciante no configuró su alias de MP','warning'); return; }
    const mpUrl = `https://mpago.la/cobrar?alias=${encodeURIComponent(alias)}&amount=${parseFloat(monto).toFixed(2)}`;
    showToast('Abriendo Mercado Pago...','info',2000);
    setTimeout(() => window.open(mpUrl,'_blank'), 500);
}

// CORREGIDO: antes escribía en `cargosAcumulados/{uid}-{mesKey}` con un
// campo `pagoIniciado` que nadie más lee — mientras que el botón "Ya
// transferí / pagué en efectivo" (pagarSuscripcion(), en store.js) escribe
// en `cargosMantenimiento` con otra forma de documento. Dos boletos de pago
// que nunca se juntaban: el panel de admin (loadCargosMantenimientoAdmin,
// en features.js) solo lee cargosMantenimiento, así que un pago hecho por
// MP quedaba invisible para el admin. Ahora escribe en la misma colección
// que el otro método, con los mismos campos, para que el admin tenga UNA
// sola cola de confirmaciones.
// También le agregué un valor por defecto al alias: si window.ALIAS_CLUB_ALMACEN
// no está declarado en ningún otro archivo (firebase.js, auth.js, etc.), antes
// el link de Mercado Pago se armaba con "alias=undefined".
function pagarSuscripcionMP(monto) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (!confirm(`¿Pagar $${parseFloat(monto).toFixed(2)} a Club Almacén?\nSe abrirá Mercado Pago con el monto precargado.`)) return;

    const alias = window.ALIAS_CLUB_ALMACEN || 'sariluh16.mp'; // TODO: confirmar que este es tu alias real
    const mpUrl = `https://mpago.la/cobrar?alias=${encodeURIComponent(alias)}&amount=${parseFloat(monto).toFixed(2)}`;

    db.collection('cargosMantenimiento').add({
        comercianteId: user.uid,
        monto: parseFloat(monto),
        fecha: new Date().toISOString(),
        pagado: false,
        mes: new Date().toLocaleDateString('es-AR', { month:'long', year:'numeric' }),
        metodo: 'mercadopago'
    }).catch(e => console.warn('pagarSuscripcionMP (registro):', e));

    showToast('Abriendo Mercado Pago para pagar a Club Almacén...','info',3000);
    setTimeout(() => window.open(mpUrl,'_blank'), 600);
}

async function renderWalletEditor(userId) {
    // DETECTAR SI ES COMERCIANTE Y USAR EL ID CORRECTO
    const user = firebase.auth().currentUser;
    let containerId = 'walletEditorContainer';
    if (user) {
        try {
            const doc = await db.collection(COL.USERS).doc(user.uid).get();
            if (doc.exists && doc.data().role === 'comerciante') {
                containerId = 'walletEditorContainerCom';
            }
        } catch(e) {}
    }
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const doc = await db.collection(COL.USERS).doc(userId).get();
        const wallet = doc.exists ? (doc.data().wallet||{}) : {};
        container.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:20px;color:white;margin-bottom:18px">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.7;margin-bottom:6px">Tu alias para recibir pagos</div>
            <div style="font-size:18px;font-weight:700">${wallet.alias||'Sin alias configurado'}</div>
            ${wallet.alias?`<div style="font-size:12px;opacity:0.6;margin-top:4px">Los clientes te pagan a este alias en Mercado Pago</div>`:''}
        </div>
        <div class="form-group">
            <label class="form-label"><i class="fas fa-at" style="color:var(--primary)"></i> Alias de Mercado Pago</label>
            <input type="text" id="walletAlias" class="form-control" value="${wallet.alias||''}" placeholder="tu.alias.mp">
            <div style="font-size:12px;color:var(--text-light);margin-top:4px">Lo encontrás en la app de Mercado Pago → Mi perfil</div>
        </div>
        <div class="form-group">
            <label class="form-label"><i class="fas fa-university" style="color:var(--primary)"></i> CVU (opcional)</label>
            <input type="text" id="walletCVU" class="form-control" value="${wallet.cvu||''}" placeholder="0000003100012345678901">
        </div>
        <div class="form-group">
            <label class="form-label"><i class="fas fa-building" style="color:var(--primary)"></i> CBU (opcional)</label>
            <input type="text" id="walletCBU" class="form-control" value="${wallet.cbu||''}" placeholder="0720461888000012345678">
        </div>
        <div class="form-group">
            <label class="form-label">Titular de la cuenta</label>
            <input type="text" id="walletTitular" class="form-control" value="${wallet.titular||''}" placeholder="Juan Pérez">
        </div>
        <div style="background:#f8f8f8;border-radius:12px;padding:14px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:8px">💳 Billeteras que aceptás</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${['Mercado Pago','Ualá','Personal Pay','Naranja X','Cuenta DNI'].map(b=>`
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:6px 12px;background:white;border-radius:20px;border:1px solid var(--border)">
                    <input type="checkbox" value="${b}" ${(wallet.billeteras||[]).includes(b)?'checked':''}> ${b}
                </label>`).join('')}
            </div>
        </div>
        <button class="btn btn-primary" onclick="guardarWallet('${userId}')" style="width:100%;padding:14px">
            <i class="fas fa-save"></i> Guardar datos de cobro
        </button>`;
    } catch(e) { container.innerHTML='<div class="no-items">Error al cargar</div>'; }
}

async function guardarWallet(userId) {
    const billeteras = [...document.querySelectorAll('#walletEditorContainer input[type=checkbox]:checked')].map(c=>c.value);
    const data = {
        alias:   document.getElementById('walletAlias')?.value?.trim()||'',
        cvu:     document.getElementById('walletCVU')?.value?.trim()||'',
        cbu:     document.getElementById('walletCBU')?.value?.trim()||'',
        titular: document.getElementById('walletTitular')?.value?.trim()||'',
        billeteras, updatedAt: new Date().toISOString()
    };
    try {
        await db.collection(COL.USERS).doc(userId).update({ wallet:data, updatedAt:new Date().toISOString() });
        showToast('✅ Datos de cobro guardados','success');
        renderWalletEditor(userId);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

function obtenerGeolocalizacion(onSuccess, onError) {
    if (!navigator.geolocation) { if(onError) onError('Tu navegador no soporta geolocalización'); return; }
    navigator.geolocation.getCurrentPosition(
        pos => onSuccess && onSuccess({ lat:pos.coords.latitude, lng:pos.coords.longitude, updatedAt:new Date().toISOString() }),
        err => onError && onError(['','Permiso denegado','No se pudo obtener','Tiempo agotado'][err.code]||'Error'),
        { enableHighAccuracy:true, timeout:10000, maximumAge:60000 }
    );
}

async function guardarGeolocalizacion(userId) {
    if (!userId) { userId = firebase.auth().currentUser?.uid; }
    if (!userId) return;
    const btn = document.getElementById('geoBtn');
    if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Obteniendo...'; }
    obtenerGeolocalizacion(
        async coords => {
            try {
                await db.collection(COL.USERS).doc(userId).update({ ubicacion:coords, updatedAt:new Date().toISOString() });
                showToast('📍 Ubicación guardada','success');
                if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-map-marker-alt"></i> Actualizar ubicación'; }
                renderMapaMiniatura(coords, document.getElementById('mapaMiniatura'));
            } catch(e) { showToast(`Error: ${e.message}`,'error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-map-marker-alt"></i> Obtener ubicación';} }
        },
        err => { showToast(err,'warning'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-map-marker-alt"></i> Obtener ubicación';} }
    );
}

function renderMapaMiniatura(coords, container) {
    if (!container || !coords) return;
    const {lat,lng} = coords;
    container.innerHTML = `
    <div style="border-radius:12px;overflow:hidden;height:160px;border:1px solid var(--border)">
        <iframe src="https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed"
            width="100%" height="160" frameborder="0" style="border:0;display:block" allowfullscreen loading="lazy"></iframe>
    </div>
    <div style="font-size:12px;color:var(--text-light);margin-top:6px;text-align:center">
        📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}
    </div>`;
}

async function guardarNombreUsuario(userId, nombreUsuario, nombreDisplay) {
    nombreUsuario = (nombreUsuario||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
    if (!nombreUsuario || nombreUsuario.length < 3) { showToast('Mínimo 3 caracteres (letras, números, _)','warning'); return false; }
    try {
        const existe = await db.collection(COL.USERS).where('nombreUsuario','==',nombreUsuario).get();
        if (!existe.empty && existe.docs[0].id !== userId) { showToast(`@${nombreUsuario} ya está en uso`,'warning'); return false; }
        await db.collection(COL.USERS).doc(userId).update({ nombreUsuario, nombreDisplay:nombreDisplay||nombreUsuario, updatedAt:new Date().toISOString() });
        showToast(`✅ @${nombreUsuario} guardado`,'success');
        return true;
    } catch(e) { showToast(`Error: ${e.message}`,'error'); return false; }
}

async function buscarUsuarios(query, rol) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim().replace('@','');
    try {
        const snap = await db.collection(COL.USERS).get();
        return snap.docs.map(d=>({id:d.id,...d.data()}))
            .filter(u => (!rol || u.role===rol) && (
                (u.nombreUsuario||'').includes(q) ||
                (u.nombreDisplay||'').toLowerCase().includes(q) ||
                (u.email||'').toLowerCase().includes(q)
            )).slice(0,10);
    } catch(e) { return []; }
}

function renderBuscadorClientes(onSelect) {
    const container = document.getElementById('buscadorClientesContainer');
    if (!container) return;
    container.innerHTML = `
    <div style="position:relative;margin-bottom:8px">
        <input type="text" id="buscarClienteInput" class="form-control"
            placeholder="🔍 Buscar por @usuario, nombre o email..."
            oninput="buscarClienteDebounced()">
        <div id="buscarClienteResultados" style="position:absolute;top:100%;left:0;right:0;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:100;display:none;max-height:220px;overflow-y:auto;border:1px solid var(--border)"></div>
    </div>`;
    window._onSelectCliente = onSelect;
    let _t;
    window.buscarClienteDebounced = () => { clearTimeout(_t); _t=setTimeout(ejecutarBusquedaCliente,300); };
}

async function ejecutarBusquedaCliente() {
    const input = document.getElementById('buscarClienteInput');
    const res   = document.getElementById('buscarClienteResultados');
    if (!input||!res) return;
    const q = input.value.trim();
    if (q.length<2) { res.style.display='none'; return; }
    res.style.display='block';
    res.innerHTML='<div style="padding:12px;text-align:center;color:var(--text-light)"><i class="fas fa-spinner fa-spin"></i></div>';
    const usuarios = await buscarUsuarios(q,'cliente');
    if (!usuarios.length) { res.innerHTML='<div style="padding:12px;text-align:center;color:var(--text-light)">Sin resultados</div>'; return; }
    res.innerHTML = usuarios.map(u=>`
    <div onclick="seleccionarClienteBuscado('${u.id}','${u.email}','${(u.nombreDisplay||u.email).replace(/'/g,"\\'")}') "
        style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0"
        onmouseover="this.style.background='#f8f8f8'" onmouseout="this.style.background='white'">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--gradient-primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">
            ${(u.nombreDisplay||u.email)[0].toUpperCase()}
        </div>
        <div>
            <div style="font-weight:600;font-size:14px">${u.nombreDisplay||u.email}</div>
            <div style="font-size:12px;color:var(--text-light)">@${u.nombreUsuario||'?'} · ${u.email}</div>
        </div>
    </div>`).join('');
}

function seleccionarClienteBuscado(id, email, nombre) {
    const input = document.getElementById('buscarClienteInput');
    const res   = document.getElementById('buscarClienteResultados');
    const sel   = document.getElementById('clienteSelectComerciante');
    if (input) input.value = `${nombre} (${email})`;
    if (res)   res.style.display='none';
    if (sel) {
        let opt = sel.querySelector(`option[value="${id}"]`);
        if (!opt) { opt=document.createElement('option'); opt.value=id; opt.textContent=`${nombre} (${email})`; sel.appendChild(opt); }
        sel.value = id; sel.dispatchEvent(new Event('change'));
    }
    if (window._onSelectCliente) window._onSelectCliente(id, email, nombre);
}

// CORREGIDO: tu HTML llama a esto como
// renderPerfilUsuario(uid, {email: firebase.auth().currentUser?.email}) —
// un objeto con SOLO el email, sin role/wallet/nombreDisplay/nombreUsuario/
// ubicación. Como la función confiaba en que el que llama le pasa el
// documento completo, dos cosas se rompían siempre: (1) nunca detectaba
// role==='comerciante', así que el perfil del comerciante se renderizaba
// siempre en el contenedor de CLIENTE (perfilUsuarioContainer), nunca en el
// suyo (perfilUsuarioContainerCom); y (2) todos los campos (nombre, alias,
// ubicación) se mostraban vacíos aunque estuvieran guardados en Firestore,
// porque nunca se leía el documento real. Ahora busca sus propios datos,
// igual que ya hace renderWalletEditor — el segundo parámetro queda como
// fallback opcional por si alguna vez lo llamás ya con los datos a mano.
async function renderPerfilUsuario(userId, userDataParcial) {
    let userData = userDataParcial || {};
    try {
        const doc = await db.collection(COL.USERS).doc(userId).get();
        if (doc.exists) userData = { ...userData, ...doc.data() };
    } catch (e) {
        console.warn('renderPerfilUsuario: no se pudo leer el documento real, usando datos parciales', e);
    }

    const user = firebase.auth().currentUser;
    let containerId = 'perfilUsuarioContainer'; // Default para cliente
    if (userData.role === 'comerciante') {
        containerId = 'perfilUsuarioContainerCom';
    }
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const wallet   = userData.wallet||{};
    const ubicacion= userData.ubicacion;
    container.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--gradient-primary);color:white;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;margin:0 auto 10px">
            ${(userData.nombreDisplay||userData.email||'U')[0].toUpperCase()}
        </div>
        <div style="font-size:18px;font-weight:800">${userData.nombreDisplay||'Sin nombre'}</div>
        <div style="font-size:14px;color:var(--text-light)">@${userData.nombreUsuario||'sin-usuario'}</div>
        <div style="font-size:13px;color:var(--text-light)">${userData.email||''}</div>
        ${user && !user.emailVerified ? `
        <div style="background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:10px;padding:10px;margin-top:10px;font-size:13px">
            ⚠️ Email sin verificar.
            <button onclick="enviarEmailVerificacion()" class="btn btn-outline" style="font-size:12px;padding:4px 12px;margin-left:8px">Reenviar</button>
        </div>` : '<div style="font-size:12px;color:var(--success);margin-top:6px">✅ Email verificado</div>'}
    </div>
    <div class="form-group">
        <label class="form-label">Nombre para mostrar</label>
        <input type="text" id="perfilNombreDisplay" class="form-control" value="${userData.nombreDisplay||''}" placeholder="Tu nombre">
    </div>
    <div class="form-group">
        <label class="form-label">Nombre de usuario (@)</label>
        <div style="display:flex;gap:8px">
            <div style="padding:13px 12px;background:#f0f0f0;border-radius:10px;font-weight:700;color:var(--text-light)">@</div>
            <input type="text" id="perfilUsername" class="form-control" value="${userData.nombreUsuario||''}" placeholder="tuusuario" style="flex:1">
        </div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px">Solo letras, números y _ · Mínimo 3 caracteres</div>
    </div>
    <div style="background:#f8f8f8;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px"><i class="fas fa-map-marker-alt" style="color:var(--primary)"></i> Mi ubicación</div>
        <div id="mapaMiniatura" style="margin-bottom:12px">${ubicacion?'<div style="font-size:13px;color:var(--success)">📍 Ubicación guardada</div>':'<div style="font-size:13px;color:var(--text-light)">Sin ubicación guardada</div>'}</div>
        <button id="geoBtn" class="btn btn-outline" onclick="guardarGeolocalizacion('${userId}')" style="width:100%">
            <i class="fas fa-map-marker-alt"></i> ${ubicacion?'Actualizar ubicación':'Obtener mi ubicación'}
        </button>
    </div>
    <button class="btn btn-primary" onclick="guardarPerfilCompleto('${userId}')" style="width:100%;padding:14px">
        <i class="fas fa-save"></i> Guardar perfil
    </button>`;
    if (ubicacion) renderMapaMiniatura(ubicacion, document.getElementById('mapaMiniatura'));
}

async function guardarPerfilCompleto(userId) {
    const nombreDisplay = document.getElementById('perfilNombreDisplay')?.value?.trim();
    const nombreUsuario = document.getElementById('perfilUsername')?.value?.trim();
    if (!nombreDisplay) { showToast('Ingresá tu nombre','warning'); return; }
    const ok = await guardarNombreUsuario(userId, nombreUsuario, nombreDisplay);
    if (ok) showToast('✅ Perfil guardado','success');
}

async function enviarEmailVerificacion() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (user.emailVerified) { showToast('Tu email ya está verificado ✅','info'); return; }
    try {
        await user.sendEmailVerification();
        showToast('📧 Email de verificación enviado. Revisá tu bandeja.','success',6000);
    } catch(e) {
        if (e.code==='auth/too-many-requests') showToast('Esperá unos minutos antes de reenviar','warning');
        else showToast(`Error: ${e.message}`,'error');
    }
}

window.pagarConMercadoPago     = pagarConMercadoPago;
window.pagarSuscripcionMP      = pagarSuscripcionMP;
window.renderWalletEditor      = renderWalletEditor;
window.guardarWallet           = guardarWallet;
window.obtenerGeolocalizacion  = obtenerGeolocalizacion;
window.guardarGeolocalizacion  = guardarGeolocalizacion;
window.renderMapaMiniatura     = renderMapaMiniatura;
window.buscarUsuarios          = buscarUsuarios;
window.renderBuscadorClientes  = renderBuscadorClientes;
window.ejecutarBusquedaCliente = ejecutarBusquedaCliente;
window.seleccionarClienteBuscado = seleccionarClienteBuscado;
window.guardarNombreUsuario    = guardarNombreUsuario;
window.renderPerfilUsuario     = renderPerfilUsuario;
window.guardarPerfilCompleto   = guardarPerfilCompleto;
window.enviarEmailVerificacion = enviarEmailVerificacion;
console.log('✅ wallet.js V5 cargado (pagarSuscripcionMP unificado con cargosMantenimiento, renderPerfilUsuario autosuficiente)');