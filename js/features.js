// ============================================
// CLUBALMACÉN V5 – features.js
// Notificaciones · Chat · Cupones · Suscripción 5% · Pagos a MP
// ============================================

// ============================================
// TOAST
// ============================================

function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success:'✅', warning:'⚠️', error:'❌', info:'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
        <span class="toast-text">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// NUEVO: CARTEL DE ÉXITO (compra enviada / pago registrado)
// ============================================
// Antes, submitPurchase() solo mostraba un toast chico (fácil de no ver en
// un celular) y confirmPayment() dependía de elementos de HTML puntuales
// (#paymentNotification) que si no existen o están mal referenciados, no
// muestran nada. Este modal se construye 100% por JS —igual que showToast()
// arma su propio contenedor— así que SIEMPRE se ve, sin depender de que tu
// HTML tenga un elemento en particular. Pensado para pantalla de celular:
// ancho acotado (340px máx), centrado, tipografía grande, botón grande.
function mostrarExitoCompra(titulo, mensaje, emoji) {
    let overlay = document.getElementById('exitoCompraOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'exitoCompraOverlay';
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.55);
            display:flex; align-items:center; justify-content:center;
            z-index:99999; padding:20px; box-sizing:border-box;
        `;
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div style="background:white;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;
             text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:exitoPop 0.25s ease;
             box-sizing:border-box">
            <div style="font-size:52px;margin-bottom:10px;line-height:1">${emoji||'✅'}</div>
            <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#1a1a1a">${titulo}</h3>
            <p style="margin:0 0 20px;font-size:14px;color:#777;line-height:1.4">${mensaje}</p>
            <button onclick="document.getElementById('exitoCompraOverlay').style.display='none'"
                style="width:100%;padding:14px;border:none;border-radius:12px;
                background:var(--gradient-primary,#e00000);color:white;font-weight:700;
                font-size:15px;cursor:pointer">
                Entendido
            </button>
        </div>`;
    overlay.style.display = 'flex';

    if (!document.getElementById('exitoCompraStyle')) {
        const style = document.createElement('style');
        style.id = 'exitoCompraStyle';
        style.textContent = `@keyframes exitoPop { from{transform:scale(0.85);opacity:0} to{transform:scale(1);opacity:1} }`;
        document.head.appendChild(style);
    }

    clearTimeout(window._exitoCompraTimeout);
    window._exitoCompraTimeout = setTimeout(() => {
        const el = document.getElementById('exitoCompraOverlay');
        if (el) el.style.display = 'none';
    }, 5000);
}

// ============================================
// NOTIFICACIONES
// ============================================

let notificaciones = [];

async function crearNotificacion(userId, mensaje, tipo, icono, iconClass, silencioso = false) {
    try {
        await db.collection('notificaciones').add({
            userId, mensaje, tipo,
            icono: icono || 'fa-bell',
            iconClass: iconClass || '',
            fecha: new Date().toISOString(),
            leida: false,
            silencioso
        });
    } catch (e) { console.warn('crearNotificacion:', e); }
}

function initNotifications(userId) {
    if (!userId) return;
    try {
        db.collection('notificaciones')
            .where('userId', '==', userId)
            .where('leida', '==', false)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (!data.silencioso) showToast(data.mensaje, data.tipo || 'info');
                    }
                });
                renderNotifBadge(snapshot.size);
            }, err => {
                // Si ves "Missing or insufficient permissions" acá, es un tema de
                // Firestore Security Rules — no de este código. Ver firestore.rules
                // (regla /notificaciones/{id}: allow read si resource.data.userId == auth.uid).
                console.warn('notif snapshot:', err);
            });
    } catch(e) { console.warn('initNotifications:', e); }
    loadNotificacionesPanel(userId);
}

function renderNotifBadge(count) {
    const dot = document.getElementById('notifDot');
    if (dot) dot.classList.toggle('visible', count > 0);
}

async function loadNotificacionesPanel(userId) {
    try {
        const snap = await db.collection('notificaciones')
            .where('userId', '==', userId)
            .get();
        notificaciones = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
            .slice(0,20);
        renderNotifPanel();
        renderNotifBadge(notificaciones.filter(n => !n.leida).length);
    } catch (e) {
        notificaciones = [
            { id:'d1', userId, mensaje:'🎉 ¡Bienvenido a Club Almacén!', tipo:'success', fecha:new Date().toISOString(), leida:false, icono:'fa-star', iconClass:'green' },
            { id:'d2', userId, mensaje:'🎟️ Tenés un cupón disponible: 10% OFF', tipo:'info', fecha:new Date().toISOString(), leida:false, icono:'fa-ticket-alt', iconClass:'orange' }
        ];
        renderNotifPanel();
    }
}

function renderNotifPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (notificaciones.length === 0) {
        list.innerHTML = '<div class="notif-empty">🔔 Sin notificaciones</div>';
        return;
    }
    list.innerHTML = notificaciones.map(n => `
    <div class="notif-item ${n.leida?'':'unread'}" onclick="marcarLeidaNotif('${n.id}')">
        <div class="notif-icon-wrap ${n.iconClass||''}">
            <i class="fas ${n.icono||'fa-bell'}"></i>
        </div>
        <div class="notif-text">
            <p>${n.mensaje}</p>
            <span>${n.fecha ? new Date(n.fecha).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
        </div>
    </div>`).join('');
}

async function marcarLeidaNotif(id) {
    notificaciones = notificaciones.map(n => n.id===id ? {...n,leida:true} : n);
    renderNotifPanel();
    renderNotifBadge(notificaciones.filter(n=>!n.leida).length);
    try { await db.collection('notificaciones').doc(id).update({ leida:true }); } catch(e){}
}

async function marcarTodasLeidas() {
    notificaciones = notificaciones.map(n => ({...n,leida:true}));
    renderNotifPanel();
    renderNotifBadge(0);
    try {
        const batch = db.batch();
        notificaciones.forEach(n => {
            if (!n.id.startsWith('d'))
                batch.update(db.collection('notificaciones').doc(n.id), { leida:true });
        });
        await batch.commit();
    } catch(e){}
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        const uid = firebase.auth().currentUser?.uid;
        if (uid) loadNotificacionesPanel(uid);
    }
}

// ============================================
// CHAT IA – ALMA
// ============================================

const CHAT_KNOWLEDGE = {
    saludo:      ['¡Hola! Soy Alma, tu asistente de Club Almacén 🛒 ¿En qué puedo ayudarte?'],
    fiado:       ['El fiado es un crédito digital que el comercio te habilita. Comprás sin pagar en el momento 📋\nPara usarlo: andá a "Nueva Compra", elegí el comercio y agregá los productos.'],
    scoring:     ['Tu scoring refleja qué tan buen pagador sos 📊\n• 300–499: Básico\n• 500–699: Confianza\n• 700+: Plus\n\nSubís pagando a tiempo.'],
    cupones:     ['En la sección **Cupones** encontrás descuentos exclusivos 🎟️\nSe desbloquean según tu scoring. ¡Mostrá el código al comerciante!'],
    pago:        ['Para pagar: andá a la pestaña **Pagos** y tocá "Pagar mis compras" 💳\nElegí efectivo o transferencia y confirmá.'],
    vaquita:     ['Las Vaquitas son colectas grupales 🤝\nCreá una, compartí el link y tus amigos aportan.'],
    comerciante: ['Para los comerciantes, Club Almacén cobra un **cargo del 5%** sobre las ventas del mes como mantenimiento de plataforma.\nLo ves en la pestaña Suscripción.'],
    default:     ['Puedo ayudarte con: **fiado**, **scoring**, **pagos**, **cupones** y **vaquitas**. ¿Sobre cuál querés saber más?']
};

let chatMessages = [], chatOpen = false, isTyping = false;

function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function detectIntent(text) {
    const t = text.toLowerCase();
    if (/fiado|credit|compra/.test(t))       return 'fiado';
    if (/scoring|puntaje|punt|nivel/.test(t)) return 'scoring';
    if (/cupon|descuento|oferta/.test(t))     return 'cupones';
    if (/pag|abonar|deber|deuda/.test(t))     return 'pago';
    if (/vaquita|colecta|aport/.test(t))      return 'vaquita';
    if (/comerciante|5%|suscri|manten/.test(t)) return 'comerciante';
    if (/hola|buenas|hey/.test(t))            return 'saludo';
    return 'default';
}

function toggleChat() {
    chatOpen = !chatOpen;
    const win = document.getElementById('chatWindow');
    if (!win) return;
    win.classList.toggle('open', chatOpen);
    if (chatOpen && chatMessages.length === 0)
        setTimeout(() => botSay(pick(CHAT_KNOWLEDGE.saludo)), 300);
    if (chatOpen) setTimeout(() => document.getElementById('chatInput')?.focus(), 350);
}

function closeChat() {
    chatOpen = false;
    document.getElementById('chatWindow')?.classList.remove('open');
}

function renderChatMsg(text, role) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const hora = new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    div.innerHTML = text
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/\n/g,'<br>') +
        `<span class="msg-time">${hora}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    if (!container || document.getElementById('chatTyping')) return;
    const el = document.createElement('div');
    el.className = 'chat-typing visible';
    el.id = 'chatTyping';
    el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() { document.getElementById('chatTyping')?.remove(); }

function botSay(text, delay = 800) {
    if (isTyping) return;
    isTyping = true;
    showTypingIndicator();
    setTimeout(() => {
        removeTypingIndicator();
        renderChatMsg(text, 'bot');
        chatMessages.push({ role:'bot', text });
        isTyping = false;
    }, delay);
}

function sendChatMessage(text) {
    if (!text?.trim()) return;
    renderChatMsg(text, 'user');
    chatMessages.push({ role:'user', text });
    const input = document.getElementById('chatInput');
    if (input) input.value = '';
    botSay(pick(CHAT_KNOWLEDGE[detectIntent(text)] || CHAT_KNOWLEDGE.default));
}

function quickQuestion(key) {
    const labels = {
        fiado:'¿Qué es el fiado?', scoring:'Mi scoring',
        pago:'¿Cómo pago?', cupones:'Ver cupones', vaquita:'¿Qué son las vaquitas?'
    };
    renderChatMsg(labels[key] || key, 'user');
    botSay(pick(CHAT_KNOWLEDGE[key] || CHAT_KNOWLEDGE.default));
}

function handleChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(document.getElementById('chatInput')?.value);
    }
}

// ============================================
// CUPONES
// ============================================

const CUPONES_CATALOGO = [
    { id:'cup001', descuento:'10%', titulo:'Descuento en Almacén',  desc:'10% en cualquier almacén adherido.',       codigo:'ALMA10',    vence:'30/07/2026', minScore:0,    icono:'🛒', badge:'Todos los niveles' },
    { id:'cup002', descuento:'15%', titulo:'Carnicería Plus',        desc:'Descuento exclusivo en carnicerías.',      codigo:'CARNE15',   vence:'15/08/2026', minScore:500,  icono:'🥩', badge:'Nivel Confianza+' },
    { id:'cup003', descuento:'20%', titulo:'Farmacia Salud',         desc:'Beneficio especial en farmacias.',         codigo:'FARM20',    vence:'31/07/2026', minScore:1500, icono:'💊', badge:'Nivel Plus' },
    { id:'cup004', descuento:'5%',  titulo:'Bienvenida Club',        desc:'¡Cupón de bienvenida por unirte!',         codigo:'BIENVE5',   vence:'31/12/2026', minScore:0,    icono:'🎁', badge:'Nuevo miembro' },
    { id:'cup005', descuento:'12%', titulo:'Pago Puntual',           desc:'Recompensa por pagar a tiempo.',           codigo:'PUNTUAL12', vence:'30/09/2026', minScore:400,  icono:'⏰', badge:'Premio puntualidad' },
    { id:'cup006', descuento:'25%', titulo:'Electro VIP',            desc:'Mejor descuento para scoring alto.',       codigo:'ELECTRO25', vence:'31/08/2026', minScore:700,  icono:'📺', badge:'Scoring Alto' },
];

let cuponesUsados = [];

async function loadCupones(userScore) {
    const grid = document.getElementById('cuponesGrid');
    if (!grid) return;
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return;
    try {
        const snap = await db.collection('cuponesUsados').where('userId','==',userId).get();
        cuponesUsados = snap.docs.map(d => d.data().cuponId);
    } catch(e) { cuponesUsados = []; }

    grid.innerHTML = CUPONES_CATALOGO.map(cup => {
        const ok   = userScore >= cup.minScore;
        const used = cuponesUsados.includes(cup.id);
        return `
        <div class="cupon-card${used?' used':''}">
            <div class="cupon-header">
                <span class="cupon-badge">${cup.badge}</span>
                <div style="font-size:30px;margin:6px 0">${cup.icono}</div>
                <div class="cupon-discount">${cup.descuento}</div>
                <div class="cupon-discount-label">DE DESCUENTO</div>
            </div>
            <div class="cupon-body">
                <div class="cupon-title">${cup.titulo}</div>
                <div class="cupon-desc">${cup.desc}</div>
                ${!ok  ? `<div style="font-size:12px;color:var(--primary);background:rgba(224,0,0,0.07);padding:6px 10px;border-radius:8px;text-align:center">🔒 Necesitás scoring ${cup.minScore}+</div>` : ''}
                ${ok && !used ? `<button class="cupon-use-btn" onclick="usarCupon('${cup.id}','${cup.codigo}','${cup.titulo}')">Usar cupón</button>` : ''}
                ${used ? '<button class="cupon-use-btn" disabled>✅ Ya utilizado</button>' : ''}
            </div>
            <div class="cupon-footer">
                <span class="cupon-code">${ok ? cup.codigo : '●●●●●●●'}</span>
                <span class="cupon-expiry">Vence ${cup.vence}</span>
            </div>
        </div>`;
    }).join('');
}

async function usarCupon(cuponId, codigo, titulo) {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return;
    if (!confirm(`¿Marcás el cupón "${titulo}" como usado?\nMostrá el código ${codigo} al comerciante.`)) return;
    try {
        await db.collection('cuponesUsados').add({ userId, cuponId, codigo, titulo, fechaUso: new Date().toISOString() });
        showToast(`Cupón ${codigo} usado ✅`, 'success');
        cuponesUsados.push(cuponId);
        const score = parseInt(document.getElementById('scoreValue')?.textContent) || 300;
        loadCupones(score);
    } catch(e) { showToast('Error al registrar el cupón.','warning'); }
}

// ============================================
// SUSCRIPCIÓN 5% – COMERCIANTE
// ============================================
// IMPORTANTE — CONFLICTO RESUELTO: tu store.js YA tenía su propio
// loadSuscripcionPanel() funcionando (calcula el 5% en vivo a partir de las
// compras aprobadas del mes, sin depender de ningún registro previo) y su
// propio pagarSuscripcion() que escribe en la colección `cargosMantenimiento`
// — la misma que ya protegiste específicamente en tus firestore.rules
// (sección 8b: "comerciante paga, admin gestiona"). Yo había agregado ACÁ un
// loadSuscripcionPanel() distinto, basado en otra colección (cargosAcumulados)
// que no coincidía con ninguna regla pensada para eso. Los dos quedaban
// asignados a window.loadSuscripcionPanel, y cuál "ganaba" dependía del
// orden en que tu HTML carga los <script> — un bug silencioso e
// impredecible. Saqué mi versión de acá por completo; la de store.js es la
// que se usa. registrarCargo5pct/cargosAcumulados quedan sin uso real (no
// rompen nada si no los llamás desde ningún botón), los dejo por si ya los
// usás en otro lado que no vi.

async function registrarCargo5pct(comercianteId, montoPago) {
    if (!comercianteId || !montoPago || montoPago <= 0) return;
    const cargo  = parseFloat((montoPago * 0.05).toFixed(2));
    const ahora  = new Date();
    const mes    = ahora.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    const mesKey = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}`;

    try {
        await db.collection('cargosAcumulados').add({
            comercianteId,
            mes,
            mesKey,
            monto: cargo,
            pagado: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Cargo 5% acumulado: $${cargo} (${mes})`);
    } catch(e) {
        console.error("❌ ERROR EN registrarCargo5pct:", e.code, e.message);
    }
}

// CORRECCIÓN — CONFLICTO RESUELTO: acá yo había agregado pagarSuscripcionMP()
// y pagarConMercadoPago() sin saber que wallet.js YA las tenía. Como
// wallet.js carga después que features.js en tu HTML, su versión ganaba
// igual en runtime — pero tenerlas duplicadas en dos archivos, con
// comportamientos distintos entre sí, es una fuente segura de bugs
// silenciosos apenas alguien cambie el orden de los <script> o edite una
// sin saber que existe la otra. Las saqué de acá. La versión real y única
// vive en wallet.js (ahí también corregí que la de MP no escribía en la
// misma colección que "Ya transferí / pagué", y que usaba
// window.ALIAS_CLUB_ALMACEN sin ningún valor por defecto).
// Lo mismo con guardarAliasMP(): wallet.js ya tiene un editor de wallet
// completo (renderWalletEditor / guardarWallet) con alias, CVU, CBU y
// billeteras, ya conectado a los contenedores reales del HTML — no hacía
// falta una función aparte solo para el alias.

// ============================================
// NUEVO: ADMIN — CONFIRMAR PAGOS DE FACTURACIÓN (cargosMantenimiento)
// ============================================
// store.js ya deja al comerciante REGISTRAR que pagó (botón "Ya transferí"
// o el de Mercado Pago de acá arriba), pero no existía ninguna pantalla para
// que el admin los revise y confirme — por eso "historialCargos" en
// store.js siempre decía "Aún no hay cargos registrados" fijo, sin leer
// nada real. Esto agrega esa pantalla, y al confirmar un pago le suma
// scoring al comerciante (sumarScoringComerciante, en scoring.js) — así es
// como el comerciante ve subir su propio scoring cuando paga su
// facturación.
// HTML sugerido: <div id="cargosMantenimientoAdminList"></div>

async function loadCargosMantenimientoAdmin() {
    const container = document.getElementById('cargosMantenimientoAdminList');
    if (!container) return;
    if (firebase.auth().currentUser?.email !== 'admin@clubalmacen.com') {
        container.innerHTML = '<div class="no-items">🔒 Solo el admin puede ver esto</div>';
        return;
    }
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const snap = await db.collection('cargosMantenimiento').where('pagado','==', false).get();
        if (snap.empty) { container.innerHTML = '<div class="no-items">Sin cargos pendientes de confirmar ✅</div>'; return; }

        const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
            .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

        const idsUnicos = [...new Set(docs.map(d => d.comercianteId))];
        const emailMap = {};
        await Promise.all(idsUnicos.map(async id => {
            const u = await db.collection(COL.USERS).doc(id).get();
            emailMap[id] = u.exists ? (u.data().email || id.slice(0,6)) : id.slice(0,6);
        }));

        container.innerHTML = docs.map(c => `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${emailMap[c.comercianteId]||'Comercio'}</h4>
                    <p style="font-size:12px;color:var(--text-light)">${c.mes||''} · ${c.metodo==='mercadopago'?'💳 Mercado Pago':'💵 Manual'}</p>
                </div>
                <div style="text-align:right">
                    <div class="purchase-total">$${(c.monto||0).toFixed(2)}</div>
                    <button class="btn btn-success" style="font-size:11px;padding:5px 10px;margin-top:6px"
                        onclick="confirmarPagoMantenimiento('${c.id}','${c.comercianteId}',${c.monto||0})">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                </div>
            </div>`).join('');
    } catch(e) {
        console.error('loadCargosMantenimientoAdmin:', e);
        container.innerHTML = '<div class="no-items">Error al cargar</div>';
    }
}

async function confirmarPagoMantenimiento(cargoId, comercianteId, monto) {
    try {
        await db.collection('cargosMantenimiento').doc(cargoId).update({ pagado:true, confirmadoAt: now() });
        showToast('✅ Pago confirmado','success');
        if (monto > 0 && typeof sumarScoringComerciante === 'function') sumarScoringComerciante(comercianteId, monto);
        loadCargosMantenimientoAdmin();
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

// ============================================
// NUEVO: CLIENTE RECIBE DINERO A SU MP
// ============================================
// Esta sí es nueva de verdad — no está en wallet.js. El cliente ya carga su
// alias en "Mi Wallet" (wallet.js se encarga de eso). Esta función es para
// que el COMERCIANTE (o Club Almacén) le envíe plata a ese alias — por
// ejemplo, un reembolso o un pago de "no puedo pagar" resuelto a mano.
// IMPORTANTE: esto es un deep-link de pago manual, no una transferencia
// automática — Firestore/JS del front no tienen acceso a la API de pagos de
// Mercado Pago (eso requiere OAuth + backend, fuera del alcance de esta app).

async function enviarDineroACliente(clienteId, montoSugerido) {
    try {
        const doc = await db.collection(COL.USERS).doc(clienteId).get();
        const alias = doc.exists ? (doc.data().wallet?.alias || null) : null;
        if (!alias) {
            showToast('El cliente todavía no cargó su alias de Mercado Pago','warning');
            return;
        }
        const montoStr = prompt('Monto a enviar:', montoSugerido ? montoSugerido.toFixed(2) : '');
        const monto = parseFloat(montoStr);
        if (!monto || monto <= 0) return;

        const mpUrl = `https://mpago.la/cobrar?alias=${encodeURIComponent(alias)}&amount=${monto.toFixed(2)}`;
        showToast('Abriendo Mercado Pago...','info',2500);
        setTimeout(() => window.open(mpUrl,'_blank'), 500);

        if (typeof crearNotificacion === 'function') {
            crearNotificacion(clienteId, `💸 Te están enviando $${monto.toFixed(2)} a tu alias de MP`, 'info','fa-hand-holding-usd','green', true);
        }
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

function closeApprovePaymentModal() {
    const m = document.getElementById('approvePaymentModal');
    if (m) m.style.display = 'none';
}

// ============================================
// EXPORTS
// ============================================

window.showToast              = showToast;
window.mostrarExitoCompra     = mostrarExitoCompra;
window.crearNotificacion      = crearNotificacion;
window.initNotifications      = initNotifications;
window.marcarLeidaNotif       = marcarLeidaNotif;
window.marcarTodasLeidas      = marcarTodasLeidas;
window.toggleNotifPanel       = toggleNotifPanel;
window.toggleChat             = toggleChat;
window.closeChat              = closeChat;
window.sendChatMessage        = sendChatMessage;
window.quickQuestion          = quickQuestion;
window.handleChatKeydown      = handleChatKeydown;
window.loadCupones            = loadCupones;
window.usarCupon              = usarCupon;
window.registrarCargo5pct     = registrarCargo5pct;
window.loadCargosMantenimientoAdmin = loadCargosMantenimientoAdmin;
window.confirmarPagoMantenimiento   = confirmarPagoMantenimiento;
window.enviarDineroACliente   = enviarDineroACliente;
window.closeApprovePaymentModal = closeApprovePaymentModal;

console.log('✅ features.js V5 cargado (duplicados con wallet.js/store.js resueltos)');