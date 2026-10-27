// ============================================
// CLUBALMACÉN V5 – admin-analytics.js  (NUEVO)
// Panel de análisis de mercado para el admin:
// compras y pagos de todos los clientes y comerciantes
// ============================================
//
// HTML mínimo sugerido (en la pantalla/tab del admin):
//   <div id="adminAnalyticsContainer"></div>
//
// Llamar loadAdminAnalytics() al abrir esa pestaña.
//
// IMPORTANTE (seguridad): esto funciona porque tus reglas actuales de
// /purchases y /payments son "allow read: if request.auth != null" —
// cualquier usuario logueado puede leer TODO, no solo el admin. Esta
// pantalla no agrega ningún permiso nuevo, simplemente aprovecha uno que
// ya estaba abierto. Si más adelante querés que SOLO el admin pueda traer
// la colección completa (y que un cliente/comerciante común solo pueda
// leer lo suyo), hay que reescribir esas dos reglas distinguiendo ambos
// casos — avisame y lo hago.

const ADMIN_EMAIL = 'admin@clubalmacen.com'; // mismo valor que usan tus firestore.rules

function _esAdmin() {
    return firebase.auth().currentUser?.email === ADMIN_EMAIL;
}

// ============================================
// CARGA Y AGREGACIÓN
// ============================================

let _AdminAnalyticsCache = { purchases: [], payments: [], users: {}, comercios: {} };

async function loadAdminAnalytics() {
    const container = document.getElementById('adminAnalyticsContainer');
    if (!container) return;

    if (!_esAdmin()) {
        container.innerHTML = '<div class="no-items">🔒 Solo el admin puede ver este panel</div>';
        return;
    }

    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando datos de mercado...</div>';

    try {
        const [purchasesSnap, paymentsSnap, usersSnap, comerciosSnap] = await Promise.all([
            db.collection(COL.PURCHASES).get(),
            db.collection(COL.PAYMENTS).get(),
            db.collection(COL.USERS).get(),
            db.collection(COL.PERFILES_COMERCIOS).get(),
        ]);

        const users = {};
        usersSnap.docs.forEach(d => { users[d.id] = d.data(); });

        const comercios = {};
        comerciosSnap.docs.forEach(d => { comercios[d.id] = d.data(); });

        const purchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments  = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        _AdminAnalyticsCache = { purchases, payments, users, comercios };
        _renderAdminAnalytics(purchases, payments, users, comercios);
    } catch (e) {
        console.error('loadAdminAnalytics:', e);
        container.innerHTML = `<div class="no-items">Error al cargar analítica: ${e.message}</div>`;
    }
}

function _nombreComercio(comercioId, comercios, users) {
    return comercios[comercioId]?.nombre || users[comercioId]?.email || comercioId?.slice(0,6) || 'Comercio';
}

function _nombreCliente(clienteId, users) {
    return users[clienteId]?.email || clienteId?.slice(0,6) || 'Cliente';
}

function _mesKey(fechaISO) {
    const d = fechaISO ? new Date(fechaISO) : null;
    if (!d || isNaN(d)) return 'sin-fecha';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function _mesLabel(mesKey) {
    if (mesKey === 'sin-fecha') return 'Sin fecha';
    const [y,m] = mesKey.split('-');
    return new Date(y, m-1, 1).toLocaleDateString('es-AR', { month:'short', year:'numeric' });
}

// ============================================
// RENDER PRINCIPAL
// ============================================

function _renderAdminAnalytics(purchases, payments, users, comercios) {
    const container = document.getElementById('adminAnalyticsContainer');
    if (!container) return;

    const aprobadas = purchases.filter(p => p.status === 'approved');
    const pendientes = purchases.filter(p => p.status === 'pending');
    const rechazadas = purchases.filter(p => p.status === 'rejected');

    const totalVentas   = aprobadas.reduce((acc,p) => acc + (p.total||0), 0);
    const ticketPromedio= aprobadas.length ? totalVentas / aprobadas.length : 0;

    const clientesActivos  = new Set(purchases.map(p => p.clienteId)).size;
    const comerciosActivos = new Set(purchases.map(p => p.comercianteId)).size;

    // ---- Ventas por comercio ----
    const porComercio = {};
    aprobadas.forEach(p => {
        porComercio[p.comercianteId] = (porComercio[p.comercianteId]||0) + (p.total||0);
    });
    const rankingComercios = Object.entries(porComercio)
        .sort((a,b) => b[1]-a[1])
        .slice(0,10);
    const maxComercio = rankingComercios.length ? rankingComercios[0][1] : 1;

    // ---- Ventas por categoría ----
    const porCategoria = {};
    aprobadas.forEach(p => {
        const cat = p.category || 'sin categoría';
        porCategoria[cat] = (porCategoria[cat]||0) + (p.total||0);
    });
    const rankingCategorias = Object.entries(porCategoria).sort((a,b) => b[1]-a[1]);
    const maxCategoria = rankingCategorias.length ? rankingCategorias[0][1] : 1;

    // ---- Ventas por mes (últimos 12 con datos) ----
    const porMes = {};
    aprobadas.forEach(p => {
        const key = _mesKey(p.approvedAt || p.createdAt);
        porMes[key] = (porMes[key]||0) + (p.total||0);
    });
    const mesesOrdenados = Object.keys(porMes).filter(k=>k!=='sin-fecha').sort().slice(-12);
    const maxMes = mesesOrdenados.length ? Math.max(...mesesOrdenados.map(k=>porMes[k])) : 1;

    // ---- Top clientes por gasto ----
    const porCliente = {};
    aprobadas.forEach(p => {
        porCliente[p.clienteId] = (porCliente[p.clienteId]||0) + (p.total||0);
    });
    const rankingClientes = Object.entries(porCliente)
        .sort((a,b) => b[1]-a[1])
        .slice(0,10);
    const maxCliente = rankingClientes.length ? rankingClientes[0][1] : 1;

    // ---- Métodos de pago ----
    const porMetodo = {};
    payments.forEach(pg => { porMetodo[pg.method||'otro'] = (porMetodo[pg.method||'otro']||0) + (pg.amount||0); });

    container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h2 style="margin:0;font-size:18px;font-weight:800"><i class="fas fa-chart-line" style="color:var(--primary)"></i> Análisis de mercado</h2>
        <div style="display:flex;gap:8px">
            <button class="btn btn-outline" style="font-size:12px;padding:6px 12px" onclick="loadAdminAnalytics()">
                <i class="fas fa-sync"></i> Actualizar
            </button>
            <button class="btn btn-primary" style="font-size:12px;padding:6px 12px" onclick="exportarComprasCSV()">
                <i class="fas fa-file-csv"></i> Exportar CSV
            </button>
        </div>
    </div>

    <!-- Resumen general -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
        ${_kpiCard('Ventas totales', `$${totalVentas.toLocaleString('es-AR',{maximumFractionDigits:0})}`, 'fa-dollar-sign')}
        ${_kpiCard('Compras aprobadas', aprobadas.length, 'fa-check-circle')}
        ${_kpiCard('Pendientes', pendientes.length, 'fa-hourglass-half')}
        ${_kpiCard('Rechazadas', rechazadas.length, 'fa-times-circle')}
        ${_kpiCard('Ticket promedio', `$${ticketPromedio.toLocaleString('es-AR',{maximumFractionDigits:0})}`, 'fa-receipt')}
        ${_kpiCard('Clientes activos', clientesActivos, 'fa-users')}
        ${_kpiCard('Comercios activos', comerciosActivos, 'fa-store')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
            <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">🏪 Top 10 comercios por ventas</h3>
            ${_renderRanking(rankingComercios, maxComercio, id => _nombreComercio(id, comercios, users))}
        </div>
        <div>
            <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">📦 Ventas por categoría</h3>
            ${_renderRanking(rankingCategorias, maxCategoria, cat => cat)}
        </div>
    </div>

    <div style="margin-top:24px">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">📅 Ventas por mes</h3>
        ${_renderBarChart(mesesOrdenados.map(k => ({ label:_mesLabel(k), valor:porMes[k] })), maxMes)}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px">
        <div>
            <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">👤 Top 10 clientes por gasto</h3>
            ${_renderRanking(rankingClientes, maxCliente, id => _nombreCliente(id, users))}
        </div>
        <div>
            <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">💳 Métodos de pago</h3>
            ${Object.entries(porMetodo).map(([metodo, monto]) => `
                <div class="purchase-item">
                    <div class="purchase-info"><h4>${metodo === 'efectivo' ? '💵 Efectivo' : metodo === 'transferencia' ? '🏦 Transferencia' : metodo}</h4></div>
                    <span class="purchase-total">$${monto.toLocaleString('es-AR',{maximumFractionDigits:0})}</span>
                </div>`).join('') || '<div class="no-items">Sin pagos registrados</div>'}
        </div>
    </div>
    `;
}

function _kpiCard(label, valor, icono) {
    return `
    <div style="background:#f8f8f8;border-radius:14px;padding:14px;text-align:center">
        <i class="fas ${icono}" style="color:var(--primary);font-size:16px;margin-bottom:6px;display:block"></i>
        <div style="font-size:18px;font-weight:800">${valor}</div>
        <div style="font-size:11px;color:var(--text-light)">${label}</div>
    </div>`;
}

function _renderRanking(entries, max, labelResolver) {
    if (entries.length === 0) return '<div class="no-items">Sin datos todavía</div>';
    return `<div style="display:flex;flex-direction:column;gap:8px">
        ${entries.map(([key, valor]) => {
            const pct = max > 0 ? Math.max((valor/max)*100, 4) : 0;
            return `
            <div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                    <span style="font-weight:600">${labelResolver(key)}</span>
                    <span style="color:var(--primary);font-weight:700">$${valor.toLocaleString('es-AR',{maximumFractionDigits:0})}</span>
                </div>
                <div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--gradient-primary);border-radius:4px"></div>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

function _renderBarChart(puntos, max) {
    if (puntos.length === 0) return '<div class="no-items">Sin datos todavía</div>';
    return `<div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding:10px 4px;overflow-x:auto">
        ${puntos.map(p => {
            const alturaPct = max > 0 ? Math.max((p.valor/max)*100, 3) : 0;
            return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:44px">
                <div style="font-size:10px;color:var(--text-light)">$${(p.valor/1000).toFixed(0)}k</div>
                <div style="width:26px;height:${alturaPct}%;background:var(--gradient-primary);border-radius:4px 4px 0 0;min-height:3px"></div>
                <div style="font-size:10px;color:var(--text-light);white-space:nowrap">${p.label}</div>
            </div>`;
        }).join('')}
    </div>`;
}

// ============================================
// EXPORTAR CSV (para análisis en Excel/Sheets)
// ============================================

function exportarComprasCSV() {
    const { purchases, users, comercios } = _AdminAnalyticsCache;
    if (!purchases.length) { showToast('No hay datos cargados. Abrí el panel primero.','warning'); return; }

    const filas = [
        ['fecha','cliente','comercio','categoria','estado','total','pagada'].join(',')
    ];
    purchases.forEach(p => {
        filas.push([
            p.createdAt || '',
            `"${_nombreCliente(p.clienteId, users)}"`,
            `"${_nombreComercio(p.comercianteId, comercios, users)}"`,
            p.category || '',
            p.status || '',
            (p.total||0).toFixed(2),
            p.paid ? 'si' : 'no'
        ].join(','));
    });

    const csv = filas.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `club-almacen-compras-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ CSV descargado','success');
}

// ============================================
// NUEVO: INICIALIZAR EL DASHBOARD ADMIN COMPLETO
// ============================================
// Esto es lo que faltaba de raíz: no existía NINGUNA función que llenara
// los contenedores reales de tu adminDashboard (catalogoElectroContainerAdmin,
// adminCobrosContainer, adminUserListContainer, adminPaymentsContainer,
// adminStatsContainer). Por eso el catálogo de electrodomésticos no cargaba
// para el admin, no se podían aprobar pagos, y no aparecía ningún usuario:
// nada los estaba llamando. Dondequiera que tu auth.js decida "este usuario
// es admin, mostrale el adminDashboard", agregale un
// `initAdminDashboard();` justo ahí.

function initAdminDashboard() {
    if (!_esAdmin()) return;
    if (typeof loadCatalogoElectro === 'function') loadCatalogoElectro(true, 'catalogoElectroContainerAdmin');
    if (typeof loadSolicitudesCredito === 'function') loadSolicitudesCredito();
    if (typeof loadCargosMantenimientoAdmin === 'function') loadCargosMantenimientoAdmin();
    loadAdminStats();
    loadAdminUserList();
    loadAdminPaymentsToApprove();
}

// ---- Estadísticas generales (adminStatsContainer) ----
async function loadAdminStats() {
    const container = document.getElementById('adminStatsContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const usersSnap = await db.collection(COL.USERS).get();
        let clientes = 0, comerciantes = 0;
        usersSnap.forEach(d => {
            const r = d.data().role;
            if (r === 'comerciante') comerciantes++;
            else if (r === 'cliente') clientes++;
        });
        const purchasesSnap = await db.collection(COL.PURCHASES).where('status','==','approved').get();
        let totalVentas = 0;
        purchasesSnap.forEach(d => { totalVentas += d.data().total || 0; });

        container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
            ${_kpiCard('Clientes', clientes, 'fa-users')}
            ${_kpiCard('Comercios', comerciantes, 'fa-store')}
            ${_kpiCard('Ventas totales', `$${totalVentas.toLocaleString('es-AR',{maximumFractionDigits:0})}`, 'fa-dollar-sign')}
        </div>`;
    } catch(e) {
        console.error('loadAdminStats:', e);
        container.innerHTML = '<div class="no-items">Error al cargar estadísticas</div>';
    }
}

// ---- Listado + buscador de TODOS los usuarios (adminUserListContainer) ----
// Esto es el "buscador de usuarios clientes y comerciantes" que pediste —
// el admin ve la lista completa y puede filtrarla en el momento.
let _AdminUsersCache = [];

async function loadAdminUserList() {
    const container = document.getElementById('adminUserListContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios...</div>';
    try {
        const snap = await db.collection(COL.USERS).get();
        _AdminUsersCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        container.innerHTML = `
        <input type="text" id="adminUserSearchInput" class="form-control" placeholder="🔍 Buscar por nombre, @usuario o email..."
            oninput="filtrarAdminUserList(this.value)" style="margin-bottom:10px">
        <div id="adminUserListResults"></div>`;
        _renderAdminUserList(_AdminUsersCache);
    } catch(e) {
        console.error('loadAdminUserList:', e);
        container.innerHTML = '<div class="no-items">Error al cargar usuarios</div>';
    }
}

function _renderAdminUserList(users) {
    const el = document.getElementById('adminUserListResults');
    if (!el) return;
    if (users.length === 0) { el.innerHTML = '<div class="no-items">Sin resultados</div>'; return; }
    el.innerHTML = users.slice(0, 100).map(u => `
        <div class="purchase-item">
            <div class="purchase-info">
                <h4>${u.nombreDisplay || u.email || u.id.slice(0,6)}</h4>
                <p style="font-size:12px;color:var(--text-light)">
                    ${u.role === 'comerciante' ? '🏪 Comercio' : u.role === 'cliente' ? '👤 Cliente' : (u.role||'sin rol')}
                    ${u.nombreUsuario ? ` · @${u.nombreUsuario}` : ''} · ${u.email||''}
                </p>
            </div>
        </div>`).join('') + (users.length > 100 ? `<div class="no-items">Mostrando 100 de ${users.length} — refiná la búsqueda</div>` : '');
}

function filtrarAdminUserList(query) {
    const q = (query||'').toLowerCase().trim().replace('@','');
    if (!q) { _renderAdminUserList(_AdminUsersCache); return; }
    const filtrados = _AdminUsersCache.filter(u =>
        (u.nombreDisplay||'').toLowerCase().includes(q) ||
        (u.nombreUsuario||'').toLowerCase().includes(q) ||
        (u.email||'').toLowerCase().includes(q)
    );
    _renderAdminUserList(filtrados);
}

// ---- Pagos pendientes de TODOS los comercios (adminPaymentsContainer) ----
// loadPaymentsToApprove() (en app.js) solo trae los pagos de UN comerciante
// puntual — el admin necesita ver los de todos juntos.
async function loadAdminPaymentsToApprove() {
    const container = document.getElementById('adminPaymentsContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando pagos...</div>';
    try {
        const snap = await db.collection(COL.PAYMENTS)
            .where('approved','==', false)
            .where('rejected','==', false)
            .get();

        if (snap.empty) { container.innerHTML = '<div class="no-items">Sin pagos pendientes ✅</div>'; return; }

        const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
            .sort((a,b) => (b.date||'').localeCompare(a.date||''));

        container.innerHTML = docs.map(p => `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${p.userEmail||'Cliente'}</h4>
                    <p>${p.method==='efectivo'?'💵 Efectivo':'🏦 Transferencia'} · $${(p.amount||0).toFixed(2)}</p>
                    ${p.comprobante?`<p style="font-size:12px;color:var(--text-light)">Comp: ${p.comprobante}</p>`:''}
                    <p style="font-size:12px;color:var(--text-light)">${p.date?new Date(p.date).toLocaleDateString('es-AR'):''}</p>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                        onclick="approvePayment('${p.id}','${p.userId}',${p.amount||0}).then(loadAdminPaymentsToApprove)">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-outline" style="font-size:12px;padding:6px 10px"
                        onclick="rejectPayment('${p.id}').then(loadAdminPaymentsToApprove)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>`).join('');
    } catch(e) {
        console.error('loadAdminPaymentsToApprove:', e);
        container.innerHTML = '<div class="no-items">Error al cargar pagos</div>';
    }
}

// ============================================
// NUEVO: SOLICITAR CRÉDITO DIRECTO (sin pasar por el catálogo)
// ============================================
// Antes la única puerta de entrada a solicitarCredito() era una tarjeta del
// catálogo de electrodomésticos — si el catálogo no cargaba (como acá),
// cliente y comerciante no tenían ninguna otra forma de pedir crédito.
function solicitarCreditoDirecto() {
    const motivo = prompt('¿Para qué querés el crédito? (ej: heladera, capital de trabajo, etc.)');
    if (!motivo || !motivo.trim()) return;
    if (typeof solicitarCredito === 'function') solicitarCredito(motivo.trim());
}
window.solicitarCreditoDirecto = solicitarCreditoDirecto;

// ============================================
// EXPORTS
// ============================================
window.initAdminDashboard      = initAdminDashboard;
window.loadAdminStats          = loadAdminStats;
window.loadAdminUserList       = loadAdminUserList;
window.filtrarAdminUserList    = filtrarAdminUserList;
window.loadAdminPaymentsToApprove = loadAdminPaymentsToApprove;
window.loadAdminAnalytics = loadAdminAnalytics;
window.exportarComprasCSV = exportarComprasCSV;

console.log('✅ admin-analytics.js cargado (dashboard admin completo: catálogo, usuarios+buscador, pagos, cobros)');