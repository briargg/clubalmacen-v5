// ============================================
// CLUBALMACÉN V5 – auth.js (CORREGIDO)
// Cambios: escape XSS, assignRole seguro, loadCatalogoElectro con
// contenedor, onclick sin inyección, errores de red, sin duplicados.
// Requiere firebase.js (window.esc, COL, now).
// ============================================

window.AuthState = { user: null, role: null };
const ADMIN_EMAILS = ['admin@clubalmacen.com'];
if (typeof window.ALIAS_CLUB_ALMACEN === 'undefined') {
    window.ALIAS_CLUB_ALMACEN = 'sariluh16.mp';
}

function showAuthView() {
    document.body.className = 'auth-mode';
    const authPage = document.getElementById('authPage');
    if (authPage) {
        authPage.style.display = 'flex';
        authPage.style.height = 'auto';
        authPage.style.minHeight = '100vh';
        authPage.style.overflow = 'auto';
        authPage.style.position = 'relative';
        authPage.style.visibility = 'visible';
    }
    const ad = document.getElementById('adminDashboard');
    const md = document.getElementById('mainDashboard');
    if (ad) ad.style.display = 'none';
    if (md) md.style.display = 'none';
    const e = document.getElementById('email');
    const p = document.getElementById('password');
    if (e) e.value = '';
    if (p) p.value = '';
    clearStatus();
}

function showAppView(role) {
    document.body.className = 'app-mode';
    const authPage = document.getElementById('authPage');
    if (authPage) {
        authPage.style.display = 'none';
        authPage.style.height = '0';
        authPage.style.minHeight = '0';
        authPage.style.overflow = 'hidden';
        authPage.style.position = 'absolute';
        authPage.style.visibility = 'hidden';
    }

    const main = document.getElementById('mainDashboard');
    main.style.display = 'block';
    main.classList.remove('hidden');

    ['adminDashboard', 'clienteDashboard', 'comercianteDashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
    });

    const targetId = role === 'admin' ? 'adminDashboard'
                   : role === 'cliente' ? 'clienteDashboard'
                   : role === 'comerciante' ? 'comercianteDashboard'
                   : null;

    if (targetId) {
        const el = document.getElementById(targetId);
        if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
    }

    if (role === 'admin') {
        setTimeout(() => { if (typeof loadAdminData === 'function') loadAdminData(); }, 500);
    }

    const em = document.getElementById('userEmail');
    if (em && AuthState.user) em.textContent = AuthState.user.email;
}

async function handleLogin() {
    const email = document.getElementById('email')?.value?.trim();
    const pass = document.getElementById('password')?.value;
    if (!email || !pass) { showStatus('Completá email y contraseña','error'); return; }
    setButtonLoading('loginButton', true);
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch(e) {
        if (e.code === 'auth/user-not-found') {
            showStatus('Usuario no encontrado. ¿Querés registrarte?','warning');
        } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            showStatus('Email o contraseña incorrectos','error');
        } else if (e.code === 'auth/network-request-failed') {
            showStatus('Sin conexión. Revisá tu internet e intentá de nuevo.','error');
        } else {
            showStatus(e.message,'error');
        }
    } finally { setButtonLoading('loginButton', false); }
}

async function handleSignup() {
    const email = document.getElementById('email')?.value?.trim();
    const pass = document.getElementById('password')?.value;
    if (!email || !pass) { showStatus('Completá email y contraseña','error'); return; }
    if (pass.length < 6) { showStatus('Mínimo 6 caracteres','error'); return; }
    setButtonLoading('signupButton', true);
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        try { await cred.user.sendEmailVerification(); } catch(e) {}
        const userRole = ADMIN_EMAILS.includes(email) ? 'admin' : null;
        await db.collection(COL.USERS).doc(cred.user.uid).set({
            email: cred.user.email, role: userRole, createdAt: now(), updatedAt: now()
        });
        if (userRole !== 'admin') {
            await db.collection(COL.USERS).doc(cred.user.uid).collection(COL.SCORING).doc('data').set({
                score:300, category:'low', totalPayments:0, onTimePayments:0, latePayments:0,
                creditUsed:0, creditLimit:0, ventasAcumuladas:0, createdAt:now(), updatedAt:now()
            });
        }
        showStatus('✅ Revisá tu email','success');
        if (userRole === 'admin') {
            document.getElementById('roleModal').style.display = 'none';
            AuthState.user = cred.user; AuthState.role = 'admin';
            showAppView('admin');
        } else {
            showRoleModal(cred.user);
        }
    } catch(e) { showStatus(e.message,'error'); }
    finally { setButtonLoading('signupButton', false); }
}

async function handleSignOut() {
    try { await auth.signOut(); } catch(e) {}
    AuthState.user = null; AuthState.role = null;
    showAuthView();
}

function showRoleModal(user) {
    const m = document.getElementById('roleModal');
    if (m) m.style.display = 'flex';
    ['selectClienteBtn','selectComercianteBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.dataset.uid = user.uid;
    });
}

async function assignRole(role) {
    if (role !== 'cliente' && role !== 'comerciante') return;
    const btnId = role === 'cliente' ? 'selectClienteBtn' : 'selectComercianteBtn';
    const uid = auth.currentUser?.uid || document.getElementById('selectClienteBtn')?.dataset?.uid;
    if (!uid) { showStatus('Sesión no válida. Volvé a iniciar sesión.','error'); return; }
    setButtonLoading(btnId, true);
    try {
        const ref = db.collection(COL.USERS).doc(uid);
        const snap = await ref.get();
        // No pisar un rol ya existente
        if (snap.exists && snap.data().role) {
            document.getElementById('roleModal').style.display = 'none';
            await loadUserAndShow(auth.currentUser);
            return;
        }
        await ref.set({ role, updatedAt: now() }, { merge: true });
        document.getElementById('roleModal').style.display = 'none';
        await loadUserAndShow(auth.currentUser);
    } catch(e) { showStatus(e.message,'error'); }
    finally { setButtonLoading(btnId, false); }
}

async function loadUserAndShow(user) {
    try {
        const doc = await db.collection(COL.USERS).doc(user.uid).get();
        const isAdmin = ADMIN_EMAILS.includes(user.email) || (doc.exists && doc.data().role === 'admin');
        if (isAdmin) {
            if (!doc.exists || doc.data().role !== 'admin') {
                await db.collection(COL.USERS).doc(user.uid).set({ email: user.email, role:'admin', updatedAt: now() }, { merge:true });
            }
            AuthState.user = user; AuthState.role = 'admin';
            showAppView('admin');
            return;
        }
        if (!doc.exists || !doc.data().role) { showRoleModal(user); return; }
        const data = doc.data();
        AuthState.user = user; AuthState.role = data.role;
        showAppView(data.role);
        if (data.role === 'cliente') {
            loadClientPurchases(user.uid); loadMyFiados(user.uid); loadPaymentHistory(user.uid); loadUserScoring(user.uid);
        } else if (data.role === 'comerciante') {
            loadPurchasesToApprove(user.uid); loadApprovedPurchasesMerchant(user.uid); loadPaymentsToApprove(user.uid);
            loadClientesFiado(user.uid); cargarClientes(); updateMerchantStats(user.uid);
            setTimeout(() => {
                if (typeof initFeatures === 'function') initFeatures(user.uid, data.role);
                if (typeof initStoreComerciante === 'function') initStoreComerciante(user.uid);
            }, 600);
        }
    } catch(e) {
        console.error('loadUserAndShow:', e);
        const offline = e.code === 'unavailable' || /offline/i.test(e.message || '');
        showStatus(offline ? 'Sin conexión con el servidor. Reintentá en unos segundos.'
                           : 'Error al cargar tu perfil.', 'error');
    }
}

function toggleAuthMode(mode) {
    const ss = document.getElementById('signupSection');
    const lb = document.getElementById('loginButton');
    const tl = document.getElementById('toggleSignupLink');
    if (mode === 'signup') {
        ss?.classList.remove('hidden'); if(lb) lb.style.display='none';
        if(tl){ tl.textContent='← Iniciar sesión'; tl.onclick=e=>{e.preventDefault();toggleAuthMode('login');}; }
    } else {
        ss?.classList.add('hidden'); if(lb) lb.style.display='block';
        if(tl){ tl.textContent='Registrate'; tl.onclick=e=>{e.preventDefault();toggleAuthMode('signup');}; }
    }
    clearStatus();
}

function setButtonLoading(id, loading) { const btn = document.getElementById(id); if(btn){btn.classList.toggle('loading', loading); btn.disabled = loading;} }
function showStatus(msg, type='info') { const el = document.getElementById('statusMessage'); if(el){el.textContent=msg;el.style.color=type==='error'?'var(--primary)':type==='success'?'var(--success)':'var(--text-light)'; if(type!=='error') setTimeout(()=>{if(el) el.textContent='';},5000);} }
function clearStatus() { const el = document.getElementById('statusMessage'); if(el) el.textContent=''; }

// ============================================
// FUNCIONES DEL ADMINISTRADOR
// ============================================

async function loadAdminData() {
    if (typeof loadAdminDashboardStats === 'function') loadAdminDashboardStats();
    if (typeof loadCatalogoElectro === 'function') loadCatalogoElectro(true, 'catalogoElectroContainerAdmin');
    if (typeof loadSolicitudesCredito === 'function') loadSolicitudesCredito();
    if (typeof loadAdminPagosComerciantes === 'function') loadAdminPagosComerciantes();
}

async function loadAdminDashboardStats() {
    const container = document.getElementById('adminStatsContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const [comerciantes, clientes, compras] = await Promise.all([
            db.collection(COL.USERS).where('role','==','comerciante').get(),
            db.collection(COL.USERS).where('role','==','cliente').get(),
            db.collection(COL.PURCHASES).where('status','==','approved').get()
        ]);
        let totalVentas = 0; compras.forEach(d => totalVentas += d.data().total || 0);
        container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;padding:5px 0">
            <div style="text-align:center;background:#f8f8f8;padding:14px;border-radius:12px">
                <div style="font-size:22px;font-weight:700;color:var(--primary)">${comerciantes.size}</div>
                <div style="font-size:11px;color:var(--text-light)">Comerciantes</div>
            </div>
            <div style="text-align:center;background:#f8f8f8;padding:14px;border-radius:12px">
                <div style="font-size:22px;font-weight:700;color:var(--primary)">${clientes.size}</div>
                <div style="font-size:11px;color:var(--text-light)">Clientes</div>
            </div>
            <div style="text-align:center;background:#f8f8f8;padding:14px;border-radius:12px">
                <div style="font-size:22px;font-weight:700;color:var(--primary)">$${totalVentas.toLocaleString('es-AR')}</div>
                <div style="font-size:11px;color:var(--text-light)">Ventas Totales</div>
            </div>
        </div>`;
    } catch(e) {
        console.error('Error stats:', e);
        container.innerHTML = '<div class="no-items">Error al cargar</div>';
    }
}

// ADMIN: APROBAR CARGOS DE MANTENIMIENTO DE COMERCIANTES
async function loadAdminPagosComerciantes() {
    const container = document.getElementById('adminCobrosContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando pagos...</div>';
    try {
        const snap = await db.collection(COL.CARGOS_MANT).where('pagado', '==', false).get();
        if (snap.empty) {
            container.innerHTML = '<div class="no-items">✅ No hay pagos de comerciantes pendientes</div>';
            return;
        }
        const ids = [...new Set(snap.docs.map(d => d.data().comercianteId).filter(Boolean))];
        const emails = {};
        await Promise.all(ids.map(async id => {
            const doc = await db.collection(COL.USERS).doc(id).get();
            if (doc.exists) emails[id] = doc.data().email || 'Comerciante';
        }));
        container.innerHTML = snap.docs.map(doc => {
            const p = doc.data();
            const monto = Number(p.monto) || 0;
            return `
            <div class="purchase-item" style="padding:10px 12px">
                <div>
                    <strong>${esc(emails[p.comercianteId] || 'Comerciante')}</strong>
                    <div style="font-size:11px;color:var(--text-light)">💰 $${monto.toFixed(2)} · ${esc(p.mes || 'Sin mes')}</div>
                </div>
                <div>
                    <button class="btn btn-success" style="font-size:10px;padding:3px 10px"
                        onclick="adminAprobarPagoComerciante('${esc(doc.id)}','${esc(p.comercianteId)}',${monto})">
                        ✅ Marcar como pagado
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        console.error('Error cargando pagos:', e);
        container.innerHTML = '<div class="no-items">Error al cargar pagos</div>';
    }
}

async function adminAprobarPagoComerciante(pagoId, comercianteId, monto) {
    if (!confirm(`¿Marcar el pago de $${monto.toFixed(2)} del comerciante como PAGADO?`)) return;
    try {
        await db.collection(COL.CARGOS_MANT).doc(pagoId).update({
            pagado: true, pagadoAt: now(), pagadoPor: 'admin'
        });
        if (typeof crearNotificacion === 'function')
            crearNotificacion(comercianteId, `✅ Tu pago de $${monto.toFixed(2)} fue confirmado por Club Almacén.`, 'success', 'fa-check-circle', 'green');
        showToast('✅ Pago de comerciante marcado como pagado', 'success');
        loadAdminPagosComerciantes();
        loadAdminDashboardStats();
    } catch(e) { showToast(`Error: ${e.message}`, 'error'); }
}

async function loadSolicitudesCredito() {
    const container = document.getElementById('solicitudesCreditoList');
    if (!container) return;
    try {
        const snap = await db.collection(COL.SOLICITUDES).where('estado','==','pendiente').get();
        if (snap.empty) { container.innerHTML='<div class="no-items">Sin solicitudes pendientes ✅</div>'; return; }
        // Los datos se guardan en memoria; el onclick solo lleva el id (sin texto del usuario)
        window._solicitudesById = {};
        snap.docs.forEach(d => { window._solicitudesById[d.id] = d.data(); });
        container.innerHTML = snap.docs.map(doc => {
            const s = doc.data();
            const f = s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-AR') : '';
            return `<div class="purchase-item" style="flex-direction:column;align-items:flex-start;gap:10px">
                <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px">
                    <div><strong>${esc(s.userEmail)}</strong>
                        <div style="font-size:13px;color:var(--text-light)">${esc(s.producto)} · DNI: ${esc(s.dni)}</div>
                        <div style="font-size:12px;color:var(--text-light)">${esc(f)}</div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                            onclick="resolverSolicitudPorId('${esc(doc.id)}',true)">✅ Aprobar</button>
                        <button class="btn btn-outline" style="font-size:12px;padding:6px 10px;color:var(--primary)"
                            onclick="resolverSolicitudPorId('${esc(doc.id)}',false)">❌ Rechazar</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML='<div class="no-items">Error al cargar solicitudes</div>'; }
}

function resolverSolicitudPorId(id, aprobado) {
    const s = (window._solicitudesById || {})[id];
    if (!s) return;
    resolverSolicitud(id, s.userId, aprobado, s.producto);
}

async function resolverSolicitud(solicitudId, userId, aprobado, producto) {
    const nota = aprobado ? '' : (prompt('Motivo del rechazo:') || 'No aprobado');
    try {
        await db.collection(COL.SOLICITUDES).doc(solicitudId).update({
            estado: aprobado ? 'aprobado' : 'rechazado', aprobado, nota, revisadoAt: now()
        });
        const msg = aprobado
            ? `✅ Tu crédito para "${producto}" fue APROBADO. Comunicate con Club Almacén.`
            : `❌ Tu crédito para "${producto}" fue rechazado. ${nota}`;
        if (typeof crearNotificacion==='function')
            crearNotificacion(userId, msg, aprobado?'success':'warning', aprobado?'fa-check-circle':'fa-times-circle', aprobado?'green':'orange');
        showToast(`Solicitud ${aprobado?'aprobada':'rechazada'}`,'success');
        loadSolicitudesCredito();
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

// containerId: 'catalogoElectroContainer' (cliente), '...Com' (comerciante), '...Admin' (admin)
async function loadCatalogoElectro(isAdmin, containerId) {
    const container = document.getElementById(containerId || (isAdmin ? 'catalogoElectroContainerAdmin' : 'catalogoElectroContainer'));
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando catálogo...</div>';
    try {
        const snap = await db.collection(COL.CATALOGO_ELECTRO).get();
        const items = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.scoring||0)-(b.scoring||0));
        window._electroById = {};
        items.forEach(i => { window._electroById[i.id] = i; });

        let html = '';
        if (isAdmin) {
            html = `<button class="btn btn-primary" onclick="mostrarFormElectro()" style="margin-bottom:16px"><i class="fas fa-plus"></i> Agregar electrodoméstico</button>
                    <div id="formElectroContainer"></div>`;
        }

        if (items.length === 0) {
            html += `<div class="no-items">📦 El catálogo está vacío. ${isAdmin ? '¡Hacé clic en el botón rojo para agregar tu primer producto!' : ''}</div>`;
            container.innerHTML = html;
            return;
        }

        const imgOk = src => typeof src === 'string' && (src.startsWith('data:image/') || src.startsWith('https://'));
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">`;
        html += items.map(item=>`
            <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow)">
                <div style="background:var(--gradient-primary);padding:18px;text-align:center;color:white;font-size:38px">
                    ${imgOk(item.imagen) ? `<img src="${esc(item.imagen)}" style="width:80px;height:80px;object-fit:contain;border-radius:8px;background:white">` : esc(item.icono||'📦')}
                </div>
                <div style="padding:12px">
                    <div style="font-weight:700;font-size:13px;margin-bottom:3px">${esc(item.nombre)}</div>
                    <div style="font-size:11px;color:var(--text-light);margin-bottom:6px">${esc(item.descripcion||'')}</div>
                    ${item.precio?`<div style="font-size:14px;font-weight:700;color:var(--primary);margin-bottom:4px">$${parseFloat(item.precio).toLocaleString('es-AR')}</div>`:''}
                    <div style="font-size:11px;background:rgba(224,0,0,0.07);color:var(--primary);padding:3px 8px;border-radius:8px;display:inline-block;margin-bottom:6px">🔒 ${Number(item.scoring) || 0} pts</div>
                    ${item.gratis?'<div style="font-size:11px;background:rgba(0,200,83,0.1);color:var(--success);padding:3px 8px;border-radius:8px;display:inline-block;margin-left:4px">🎁 ¡Gratis!</div>':''}

                    ${isAdmin ? `
                    <div style="display:flex;gap:4px;margin-top:8px">
                        <button onclick="editarElectro('${esc(item.id)}')" class="btn btn-outline" style="flex:1;font-size:11px;padding:5px">Editar</button>
                        <button onclick="eliminarElectro('${esc(item.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px;color:var(--primary)">🗑️</button>
                    </div>` : `
                    <div style="display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px">
                        ${item.gratis ? `
                        <button onclick="reclamarRegalo(window._electroById['${esc(item.id)}'].nombre)" class="btn btn-secondary" style="width:100%;font-size:11px;padding:7px">
                            🎁 Reclamar gratis
                        </button>` : `
                        <button onclick="solicitarCredito(window._electroById['${esc(item.id)}'].nombre)" class="btn btn-primary" style="width:100%;font-size:11px;padding:7px">
                            💳 Comprar con crédito
                        </button>
                        <button onclick="solicitarFiado(window._electroById['${esc(item.id)}'].nombre, window._electroById['${esc(item.id)}'].precio||0)" class="btn btn-outline" style="width:100%;font-size:11px;padding:7px;border-color:var(--success);color:var(--success)">
                            📋 Sacar fiado
                        </button>`}
                    </div>`}
                </div>
            </div>`).join('');
        html += `</div>`;

        container.innerHTML = html;
    } catch(e) {
        console.error('Error cargando catálogo:', e);
        container.innerHTML = '<div class="no-items">Error al cargar catálogo</div>';
    }
}

function mostrarFormElectro(item) {
    const c = document.getElementById('formElectroContainer');
    if (!c) return;
    const imgOk = typeof item?.imagen === 'string' && (item.imagen.startsWith('data:image/') || item.imagen.startsWith('https://'));
    window._electroTempImage = null;
    c.innerHTML = `<div style="background:#f8f8f8;border-radius:14px;padding:18px;margin-bottom:16px">
        <input type="hidden" id="electoId" value="${esc(item?.id||'')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label class="form-label">Nombre</label><input type="text" id="electroNombre" class="form-control" value="${esc(item?.nombre||'')}" placeholder="Ej: Televisor LED"></div>
            <div class="form-group">
                <label class="form-label">Imagen del producto (máx. 500 KB)</label>
                <div style="display:flex;gap:10px;align-items:center">
                    <input type="file" id="electroImagenInput" accept="image/*" style="display:none" onchange="previewElectroImagen(event)">
                    <button class="btn btn-outline" onclick="document.getElementById('electroImagenInput').click()" style="font-size:12px;padding:6px 12px">
                        <i class="fas fa-image"></i> Seleccionar foto
                    </button>
                    <div id="electroImagenPreview" style="width:40px;height:40px;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden">
                        ${imgOk ? `<img src="${esc(item.imagen)}" style="width:100%;height:100%;object-fit:cover">` : '📷'}
                    </div>
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label class="form-label">Precio ($)</label><input type="number" id="electroPrecio" class="form-control" value="${esc(item?.precio||'')}"></div>
            <div class="form-group"><label class="form-label">Scoring requerido</label><input type="number" id="electroScoring" class="form-control" value="${esc(item?.scoring||500)}"></div>
        </div>
        <div class="form-group"><label class="form-label">Descripción</label><input type="text" id="electroDesc" class="form-control" value="${esc(item?.descripcion||'')}"></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;margin-bottom:12px">
            <input type="checkbox" id="electroGratis" ${item?.gratis?'checked':''}> ¿Es gratis por scoring?
        </label>
        <div style="display:flex;gap:10px">
            <button class="btn btn-primary" onclick="guardarElectro()" style="flex:1"><i class="fas fa-save"></i> Guardar</button>
            <button class="btn btn-outline" onclick="document.getElementById('formElectroContainer').innerHTML=''" style="padding:12px 16px">Cancelar</button>
        </div>
    </div>`;
}

function previewElectroImagen(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
        showToast('La imagen supera 500 KB. Elegí una más liviana.', 'warning');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('electroImagenPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
            window._electroTempImage = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

async function guardarElectro() {
    const id = document.getElementById('electoId')?.value;
    const data = {
        nombre: document.getElementById('electroNombre')?.value?.trim(),
        icono: '📦',
        imagen: window._electroTempImage || document.querySelector('#electroImagenPreview img')?.src || '📦',
        precio: parseFloat(document.getElementById('electroPrecio')?.value) || 0,
        scoring: parseInt(document.getElementById('electroScoring')?.value) || 500,
        descripcion: document.getElementById('electroDesc')?.value?.trim() || '',
        gratis: document.getElementById('electroGratis')?.checked || false,
        updatedAt: now()
    };
    if (!data.nombre) { showToast('Ingresá el nombre','warning'); return; }
    try {
        if (id) { await db.collection(COL.CATALOGO_ELECTRO).doc(id).update(data); }
        else { data.createdAt = now(); await db.collection(COL.CATALOGO_ELECTRO).add(data); }
        showToast('Electrodoméstico guardado ✅','success');
        document.getElementById('formElectroContainer').innerHTML = '';
        window._electroTempImage = null;
        loadCatalogoElectro(true, 'catalogoElectroContainerAdmin');
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function eliminarElectro(id) {
    if (!confirm('¿Eliminar este producto del catálogo?')) return;
    try {
        await db.collection(COL.CATALOGO_ELECTRO).doc(id).delete();
        showToast('Eliminado','info');
        loadCatalogoElectro(true, 'catalogoElectroContainerAdmin');
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function editarElectro(id) {
    const d = await db.collection(COL.CATALOGO_ELECTRO).doc(id).get();
    if (d.exists) mostrarFormElectro({id, ...d.data()});
}

// ============================================
// LISTENERS DE AUTENTICACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton')?.addEventListener('click', handleLogin);
    document.getElementById('signupButton')?.addEventListener('click', handleSignup);
    document.getElementById('logoutBtn')?.addEventListener('click', handleSignOut);
    document.getElementById('toggleSignupLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthMode('signup');
    });
    document.getElementById('selectClienteBtn')?.addEventListener('click', () => assignRole('cliente'));
    document.getElementById('selectComercianteBtn')?.addEventListener('click', () => assignRole('comerciante'));
});

auth.onAuthStateChanged((user) => {
    if (user) loadUserAndShow(user);
    else showAuthView();
});

// ============================================
// REGISTRO CON GOOGLE
// ============================================
window.registrarConGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(async (result) => {
        const user = result.user;
        const doc = await db.collection(COL.USERS).doc(user.uid).get();
        if (!doc.exists) {
            await db.collection(COL.USERS).doc(user.uid).set({
                email: user.email,
                role: null,
                nombreDisplay: user.displayName || user.email,
                createdAt: now(), updatedAt: now()
            });
            await db.collection(COL.USERS).doc(user.uid).collection(COL.SCORING).doc('data').set({
                score: 300, category: 'low', totalPayments: 0, onTimePayments: 0,
                latePayments: 0, creditUsed: 0, creditLimit: 0,
                ventasAcumuladas: 0, createdAt: now(), updatedAt: now()
            });
        }
        await loadUserAndShow(user);
    }).catch(e => {
        if (e.code === 'auth/popup-closed-by-user') return;
        showStatus(`Error: ${e.message}`, 'error');
    });
};

window.handleSignOut = handleSignOut;
window.assignRole = assignRole;
window.showStatus = showStatus;
window.toggleAuthMode = toggleAuthMode;
window.setButtonLoading = setButtonLoading;
window.loadAdminData = loadAdminData;
window.loadAdminDashboardStats = loadAdminDashboardStats;
window.loadAdminPagosComerciantes = loadAdminPagosComerciantes;
window.adminAprobarPagoComerciante = adminAprobarPagoComerciante;
window.loadSolicitudesCredito = loadSolicitudesCredito;
window.resolverSolicitud = resolverSolicitud;
window.resolverSolicitudPorId = resolverSolicitudPorId;
window.loadCatalogoElectro = loadCatalogoElectro;
window.mostrarFormElectro = mostrarFormElectro;
window.previewElectroImagen = previewElectroImagen;
window.guardarElectro = guardarElectro;
window.eliminarElectro = eliminarElectro;
window.editarElectro = editarElectro;

console.log('✅ auth.js cargado');