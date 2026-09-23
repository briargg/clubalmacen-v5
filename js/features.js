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
// SUSCRIPCIÓN 5% – COMERCIANTE (VERSIÓN CON MERCADO PAGO)
// ============================================

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

async function pagarSuscripcionMP(monto) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (!confirm(`¿Confirmás el pago de $${parseFloat(monto).toFixed(2)} a Club Almacén?\nSe abrirá Mercado Pago con el monto precargado.`)) return;

    const alias = window.ALIAS_CLUB_ALMACEN || 'sariluh16.mp';
    const mpUrl = `https://mpago.la/cobrar?alias=${encodeURIComponent(alias)}&amount=${parseFloat(monto).toFixed(2)}`;

    const ahora = new Date();
    const mesKey = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}`;
    try {
        await db.collection('cargosAcumulados').doc(`${user.uid}-${mesKey}-pendiente`).set({
            comercianteId: user.uid,
            mesKey: mesKey,
            monto: parseFloat(monto),
            estado: 'pendiente_mp',
            createdAt: ahora.toISOString()
        }, { merge: true });
    } catch(e) {}

    showToast('Abriendo Mercado Pago para pagar a Club Almacén...','info',3000);
    setTimeout(() => window.open(mpUrl,'_blank'),600);
}

// ============================================
// NUEVO: PANEL DE SUSCRIPCIÓN (ESTO ES LO QUE FALTABA)
// ============================================
// El código viejo hacía `window.loadSuscripcionPanel = loadSuscripcionPanel;`
// pero la función nunca estaba definida en el archivo → ReferenceError silencioso
// y la pestaña "Suscripción" del comerciante quedaba sin implementar.
// Requiere en el HTML del comerciante: <div id="suscripcionContainer"></div>
// y llamar loadSuscripcionPanel(comercianteId) al abrir esa pestaña.

async function loadSuscripcionPanel(comercianteId) {
    const container = document.getElementById('suscripcionContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const snap = await db.collection('cargosAcumulados')
            .where('comercianteId','==', comercianteId)
            .get();

        // Descartamos el doc placeholder "-pendiente" que crea pagarSuscripcionMP
        // (no tiene "mes" legible todavía) y ordenamos el resto por mes.
        const cargos = snap.docs
            .map(d => ({ id:d.id, ...d.data() }))
            .filter(c => c.mes)
            .sort((a,b) => (b.mesKey||'').localeCompare(a.mesKey||''));

        const pendientes     = cargos.filter(c => !c.pagado);
        const totalPendiente = pendientes.reduce((acc,c) => acc + (c.monto||0), 0);

        if (cargos.length === 0) {
            container.innerHTML = `
            <div style="background:var(--gradient-primary);border-radius:16px;padding:20px;color:white;text-align:center">
                <div style="font-size:13px;opacity:0.85">Cargo por mantenimiento (5%)</div>
                <div style="font-size:32px;font-weight:800;margin:6px 0">$0.00</div>
                <div style="font-size:12px;opacity:0.85">Todavía no acumulaste cargos este mes</div>
            </div>`;
            return;
        }

        container.innerHTML = `
        <div style="background:var(--gradient-primary);border-radius:16px;padding:20px;color:white;text-align:center;margin-bottom:18px">
            <div style="font-size:13px;opacity:0.85">Total pendiente de pago</div>
            <div style="font-size:32px;font-weight:800;margin:6px 0">$${totalPendiente.toFixed(2)}</div>
            ${totalPendiente > 0
                ? `<button style="background:white;color:var(--primary);font-weight:700;padding:10px 20px;border-radius:10px;margin-top:8px;border:none;cursor:pointer"
                     onclick="pagarSuscripcionMP(${totalPendiente})">
                     <i class="fas fa-money-bill-wave"></i> Pagar con Mercado Pago
                   </button>`
                : `<div style="font-size:13px;margin-top:6px">✅ Estás al día</div>`}
        </div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Historial por mes</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
        ${cargos.map(c => `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4 style="text-transform:capitalize">${c.mes||c.mesKey}</h4>
                    <p style="font-size:12px;color:var(--text-light)">${c.pagado?'✅ Pagado':'⏳ Pendiente'}</p>
                </div>
                <span class="purchase-total">$${(c.monto||0).toFixed(2)}</span>
            </div>`).join('')}
        </div>`;
    } catch (e) {
        console.error('loadSuscripcionPanel:', e);
        container.innerHTML = '<div class="no-items">Error al cargar la suscripción</div>';
    }
}

// Uso administrativo: marcar cargos como pagados una vez que Club Almacén
// confirma manualmente que recibió la transferencia por MP (no hay webhook
// automático porque el link mpago.la/cobrar no devuelve confirmación al front).
async function marcarCargosComoPagados(comercianteId) {
    try {
        const snap = await db.collection('cargosAcumulados')
            .where('comercianteId','==', comercianteId)
            .where('pagado','==', false)
            .get();
        const batch = db.batch();
        snap.forEach(doc => {
            if (doc.data().mes) batch.update(doc.ref, { pagado:true, pagadoAt: now() });
        });
        await batch.commit();
        showToast('Cargos marcados como pagados ✅','success');
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

// ============================================
// NUEVO: CLIENTE RECIBE DINERO A SU MP
// ============================================
// El cliente carga su alias/CVU una sola vez; luego cualquier comerciante (o
// Club Almacén) puede usar ese alias para enviarle plata via un link mpago.la
// que el comerciante abre y completa desde su propio Mercado Pago.
// IMPORTANTE: esto es un deep-link de pago manual, no una transferencia
// automática — Firestore/JS del front no tienen acceso a la API de pagos de
// Mercado Pago (eso requiere OAuth + backend, fuera del alcance de esta app).

async function guardarAliasMP(alias) {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión','warning'); return; }
    const limpio = (alias||'').trim();
    if (!limpio) { showToast('Ingresá tu alias o CVU de Mercado Pago','warning'); return; }
    try {
        await db.collection(COL.USERS).doc(user.uid).set({
            wallet: { alias: limpio, updatedAt: new Date().toISOString() }
        }, { merge:true });
        showToast('✅ Alias de MP guardado. Ya podés recibir pagos.','success');
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

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
window.pagarSuscripcionMP     = pagarSuscripcionMP;
window.loadSuscripcionPanel   = loadSuscripcionPanel;
window.marcarCargosComoPagados= marcarCargosComoPagados;
window.guardarAliasMP         = guardarAliasMP;
window.enviarDineroACliente   = enviarDineroACliente;
window.closeApprovePaymentModal = closeApprovePaymentModal;

console.log('✅ features.js V5 cargado (panel de suscripción + pagos a cliente agregados)');