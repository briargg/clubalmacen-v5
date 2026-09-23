// ============================================
// CLUBALMACÉN V5 – vaquitas.js  (CORREGIDO: compartir)
// ============================================

const VaquitaState = { lista: [], actual: null };

const TIPOS_VAQUITA = [
    { id:'asado',   icono:'🥩', nombre:'Asado',   color:'linear-gradient(135deg,#e74c3c,#c0392b)' },
    { id:'juntada', icono:'🎉', nombre:'Juntada', color:'linear-gradient(135deg,#f39c12,#e67e22)' },
    { id:'ayuda',   icono:'🤝', nombre:'Ayuda',   color:'linear-gradient(135deg,#2ecc71,#27ae60)' },
    { id:'viaje',   icono:'✈️', nombre:'Viaje',   color:'linear-gradient(135deg,#3498db,#2980b9)' },
    { id:'regalo',  icono:'🎁', nombre:'Regalo',  color:'linear-gradient(135deg,#9b59b6,#8e44ad)' },
];

// ============================================
// CARGAR VAQUITAS
// ============================================

async function cargarVaquitas() {
    const container = document.getElementById('vaquitasGrid');
    if (!container) return;

    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)">
        <i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--primary)"></i>
        <p style="margin-top:12px">Cargando vaquitas...</p></div>`;

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px">
                <p style="color:var(--text-light)">Iniciá sesión para ver tus vaquitas</p></div>`;
            return;
        }

        // Sin orderBy para no requerir índice compuesto
        const snap = await db.collection(COL.VAQUITAS)
            .where('activa', '==', true)
            .get();

        VaquitaState.lista = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const fa = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const fb = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return fb - fa;
            });

        if (VaquitaState.lista.length === 0) {
            container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text-light)">
                <div style="font-size:56px;margin-bottom:14px">🤝</div>
                <h3 style="font-weight:700;margin-bottom:8px">No hay vaquitas activas</h3>
                <p style="margin-bottom:20px">Sé el primero en crear una.</p>
                <button class="btn btn-primary" onclick="abrirModalVaquita()">
                    <i class="fas fa-plus"></i> Crear Vaquita
                </button>
            </div>`;
            return;
        }

        container.innerHTML = VaquitaState.lista.map(v => _renderVaquitaCard(v, user.uid)).join('');

    } catch (err) {
        console.error('cargarVaquitas:', err);
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px">
            <p style="color:var(--primary)">❌ Error al cargar vaquitas</p>
            <p style="font-size:12px;color:var(--text-light)">${err.message}</p>
            <button class="btn btn-outline" onclick="cargarVaquitas()" style="margin-top:12px">
                <i class="fas fa-sync"></i> Reintentar
            </button>
        </div>`;
    }
}

function _renderVaquitaCard(v, currentUid) {
    const tipo   = TIPOS_VAQUITA.find(t => t.id === v.tipo) || TIPOS_VAQUITA[0];
    const pct    = v.montoTotal > 0 ? Math.min((v.montoRecaudado / v.montoTotal) * 100, 100) : 0;
    const partic = v.participantes?.length || 0;
    const esMio  = v.creadorId === currentUid;
    const diasRest = v.fecha ? Math.max(0, Math.ceil((new Date(v.fecha) - new Date()) / 86400000)) : null;

    return `
    <div class="vaquita-card" onclick="verVaquita('${v.id}')">
        <div class="vaquita-header" style="background:${tipo.color}">
            <span style="font-size:32px">${tipo.icono}</span>
            <div style="flex:1;min-width:0">
                <div class="vaquita-tipo">${tipo.nombre}</div>
                <div style="font-size:11px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.descripcion||''}</div>
            </div>
            ${esMio ? '<span style="background:rgba(255,255,255,0.25);font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700">MÍA</span>' : ''}
        </div>
        <div class="vaquita-body">
            <h4 style="margin:0 0 4px;font-weight:700;font-size:14px;line-height:1.3">${v.descripcion||'Sin descripción'}</h4>
            <p style="font-size:12px;color:var(--text-light);margin:0 0 10px">
                <i class="fas fa-user"></i> ${v.creadorEmail?.split('@')[0]||'Usuario'}
                ${diasRest !== null ? ` · <i class="fas fa-clock"></i> ${diasRest===0?'Hoy':`${diasRest}d`}` : ''}
            </p>
            <div class="vaquita-progreso">
                <div class="vaquita-bar" style="width:${pct}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-top:4px">
                <span style="color:var(--primary)">$${(v.montoRecaudado||0).toLocaleString('es-AR')}</span>
                <span style="color:var(--text-light)">${v.montoTotal>0?`$${v.montoTotal.toLocaleString('es-AR')}`:'Sin objetivo'}</span>
            </div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;background:#f0f0f0;padding:3px 10px;border-radius:12px;font-weight:600">
                    <i class="fas fa-users"></i> ${partic}
                </span>
                <span style="font-size:11px;background:#f0f0f0;padding:3px 10px;border-radius:12px;font-weight:600">
                    ${pct.toFixed(0)}% completado
                </span>
            </div>
        </div>
        <div class="vaquita-footer">
            <div style="display:flex;gap:8px">
                <button class="btn btn-primary" style="flex:1;font-size:12px;padding:8px"
                    onclick="event.stopPropagation();aportarVaquita('${v.id}')">
                    <i class="fas fa-hand-holding-heart"></i> Aportar
                </button>
                <button class="btn btn-outline" style="font-size:12px;padding:8px 10px"
                    onclick="event.stopPropagation();compartirVaquita('${v.id}')" title="Compartir">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        </div>
    </div>`;
}

// ============================================
// VER DETALLE
// ============================================

async function verVaquita(vaquitaId) {
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) return;

    overlay.innerHTML = `<div class="modal-content" style="max-width:480px;width:95%">
        <div style="text-align:center;padding:40px">
            <i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary)"></i>
        </div></div>`;
    overlay.style.display = 'flex';

    try {
        const [vDoc, aportesSnap] = await Promise.all([
            db.collection(COL.VAQUITAS).doc(vaquitaId).get(),
            db.collection(COL.VAQUITAS).doc(vaquitaId)
                .collection(COL.APORTES).get()
        ]);

        if (!vDoc.exists) {
            overlay.style.display = 'none';
            showToast('Vaquita no encontrada','error');
            return;
        }

        const v      = { id: vDoc.id, ...vDoc.data() };

        // CORRECCIÓN: si la vaquita se abrió por deep link, todavía no está en
        // VaquitaState.lista. La agregamos para que compartirVaquita() tenga
        // la descripción disponible en vez de caer siempre al texto genérico.
        if (!VaquitaState.lista.some(x => x.id === v.id)) VaquitaState.lista.push(v);

        const tipo   = TIPOS_VAQUITA.find(t => t.id === v.tipo) || TIPOS_VAQUITA[0];
        const pct    = v.montoTotal > 0 ? Math.min((v.montoRecaudado/v.montoTotal)*100, 100) : 0;
        const aportes= aportesSnap.docs
            .map(d => d.data())
            .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));
        const user     = firebase.auth().currentUser;
        const esCreador= v.creadorId === user?.uid;
        const link     = `${location.origin}${location.pathname}?vaquita=${vaquitaId}`;

        overlay.innerHTML = `
        <div class="modal-content" style="max-width:480px;width:95%;padding:0;overflow:hidden">
            <div style="background:${tipo.color};padding:24px 20px;color:white;position:relative;text-align:center">
                <button onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none'"
                    style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.2);border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px">✕</button>
                <div style="font-size:48px;margin-bottom:8px">${tipo.icono}</div>
                <h2 style="margin:0;font-size:20px;font-weight:800">${v.descripcion||'Vaquita'}</h2>
                <p style="opacity:0.85;font-size:13px;margin:4px 0 0">por ${v.creadorEmail?.split('@')[0]||'Usuario'}</p>
            </div>
            <div style="padding:20px">
                <div style="margin-bottom:16px">
                    <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:8px">
                        <span style="color:var(--primary);font-size:22px">$${(v.montoRecaudado||0).toLocaleString('es-AR')}</span>
                        <span style="color:var(--text-light)">${v.montoTotal>0?`de $${v.montoTotal.toLocaleString('es-AR')}`:'Sin objetivo'}</span>
                    </div>
                    <div style="height:10px;background:#f0f0f0;border-radius:6px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:var(--gradient-primary);border-radius:6px"></div>
                    </div>
                    <div style="text-align:center;font-size:13px;font-weight:700;margin-top:6px;color:var(--text-light)">${pct.toFixed(1)}% completado</div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
                    <div style="background:#f8f8f8;border-radius:12px;padding:12px;text-align:center">
                        <div style="font-size:20px;font-weight:800;color:var(--primary)">${v.participantes?.length||0}</div>
                        <div style="font-size:11px;color:var(--text-light)">APORTANTES</div>
                    </div>
                    <div style="background:#f8f8f8;border-radius:12px;padding:12px;text-align:center">
                        <div style="font-size:16px;font-weight:800;color:var(--primary)">
                            ${v.fecha ? new Date(v.fecha).toLocaleDateString('es-AR',{day:'numeric',month:'short'}) : '—'}
                        </div>
                        <div style="font-size:11px;color:var(--text-light)">FECHA</div>
                    </div>
                </div>

                <!-- Link compartir -->
                <div style="background:#f0f0f0;border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:14px">
                    <i class="fas fa-link" style="color:var(--primary)"></i>
                    <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${link}</span>
                    <button onclick="compartirVaquita('${v.id}')"
                        style="background:none;border:none;color:var(--primary);cursor:pointer;font-weight:700">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>

                <!-- Aportes recientes -->
                ${aportes.length > 0 ? `
                <h4 style="font-size:14px;font-weight:700;margin:0 0 10px">Aportes recientes</h4>
                ${aportes.slice(0,5).map(a => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                    <span><i class="fas fa-user-circle" style="color:var(--primary);margin-right:6px"></i>${a.nombre||a.aportanteEmail?.split('@')[0]||'Anónimo'}</span>
                    <div style="text-align:right">
                        <strong>$${(a.monto||0).toLocaleString('es-AR')}</strong>
                        <div style="font-size:11px;color:var(--text-light)">${a.fecha?new Date(a.fecha).toLocaleDateString('es-AR'):''}</div>
                    </div>
                </div>`).join('')}
                ` : '<p style="text-align:center;color:var(--text-light);font-size:13px;margin:0 0 14px">Sin aportes todavía. ¡Sé el primero!</p>'}

                <!-- Acciones -->
                <div style="display:flex;gap:10px;margin-top:16px">
                    <button class="btn btn-primary" style="flex:1"
                        onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none';aportarVaquita('${v.id}')">
                        <i class="fas fa-hand-holding-heart"></i> Aportar
                    </button>
                    <button class="btn btn-outline" style="padding:12px 14px" onclick="compartirVaquita('${v.id}')">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    ${esCreador ? `<button class="btn btn-outline" style="padding:12px 14px" onclick="cerrarVaquita('${v.id}')">
                        <i class="fas fa-lock"></i>
                    </button>` : ''}
                </div>
            </div>
        </div>`;

    } catch (err) {
        console.error('verVaquita:', err);
        overlay.style.display = 'none';
        showToast('Error al cargar la vaquita','error');
    }
}

// ============================================
// APORTAR
// ============================================

function aportarVaquita(vaquitaId) {
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
    <div class="modal-content" style="max-width:380px;width:95%;text-align:center">
        <div style="font-size:44px;margin-bottom:12px">🤝</div>
        <h3 style="font-weight:800;margin-bottom:8px">¿Cuánto querés aportar?</h3>
        <p style="font-size:13px;color:var(--text-light);margin-bottom:16px">
            Registrá tu aporte. Coordiná el pago directamente con el organizador.
        </p>
        <input type="number" id="montoAporte" class="form-control"
            placeholder="$ 0.00" step="50" min="1"
            style="text-align:center;font-size:22px;font-weight:700;margin-bottom:12px">
        <input type="text" id="nombreAportante" class="form-control"
            placeholder="Tu nombre (opcional)" style="margin-bottom:16px">
        <div style="display:flex;gap:10px">
            <button class="btn btn-outline" style="flex:1"
                onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none'">
                Cancelar
            </button>
            <button class="btn btn-primary" style="flex:1" onclick="confirmarAporte('${vaquitaId}')">
                <i class="fas fa-check"></i> Confirmar
            </button>
        </div>
    </div>`;
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('montoAporte')?.focus(), 100);
}

async function confirmarAporte(vaquitaId) {
    const monto  = parseFloat(document.getElementById('montoAporte')?.value);
    const nombre = document.getElementById('nombreAportante')?.value?.trim();
    if (!monto || monto <= 0) { showToast('Ingresá un monto válido','warning'); return; }

    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para aportar','warning'); return; }

    try {
        const vRef = db.collection(COL.VAQUITAS).doc(vaquitaId);
        const vDoc = await vRef.get();
        if (!vDoc.exists) throw new Error('Vaquita no encontrada');
        const v = vDoc.data();

        await vRef.collection(COL.APORTES).add({
            aportanteId:    user.uid,
            aportanteEmail: user.email,
            nombre:         nombre || user.email?.split('@')[0],
            monto,
            fecha:          new Date().toISOString()
        });

        const participantes = v.participantes || [];
        if (!participantes.includes(user.uid)) participantes.push(user.uid);

        await vRef.update({
            montoRecaudado: (v.montoRecaudado || 0) + monto,
            participantes,
            updatedAt: new Date().toISOString()
        });

        document.getElementById('vaquitaDetalleOverlay').style.display = 'none';
        showToast(`✅ Aporte de $${monto.toLocaleString('es-AR')} registrado!`,'success');

        if (typeof crearNotificacion === 'function') {
            crearNotificacion(
                v.creadorId,
                `💰 ${user.email?.split('@')[0]} aportó $${monto.toLocaleString('es-AR')} a "${v.descripcion}"`,
                'success','fa-hand-holding-heart','green'
            );
        }

        cargarVaquitas();
    } catch (err) {
        console.error('confirmarAporte:', err);
        showToast(`Error: ${err.message}`,'error');
    }
}

// ============================================
// COMPARTIR  (CORREGIDO)
// ============================================
//
// El bug: en file:// (o cualquier http sin SSL) navigator.clipboard NO EXISTE
// y navigator.share tampoco está disponible en la mayoría de los navegadores
// de escritorio. El código viejo llamaba directo a navigator.clipboard.writeText()
// sin verificar que existiera => tiraba una excepción no capturada y no pasaba
// nada en pantalla. Ahora probamos en cascada y siempre garantizamos un modal
// con el link para copiar a mano como último recurso.

function compartirVaquita(vaquitaId) {
    const link = `${location.origin}${location.pathname}?vaquita=${vaquitaId}`;
    const v    = VaquitaState.lista.find(x => x.id === vaquitaId);
    const text = `🤝 Sumate a la vaquita "${v?.descripcion||'Club Almacén'}"!\n${link}`;

    // 1. Web Share API nativa (funciona en celulares y algunos navegadores HTTPS)
    if (navigator.share) {
        navigator.share({ title:'Club Almacén – Vaquita', text, url:link })
            .catch(err => {
                if (err?.name !== 'AbortError') _mostrarModalCompartir(link, text);
            });
        return;
    }

    // 2. Clipboard API moderna (requiere contexto seguro: https o localhost)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Link copiado ✅','success'))
            .catch(() => _mostrarModalCompartir(link, text));
        return;
    }

    // 3. Fallback universal — funciona incluso abriendo el HTML como file://
    _mostrarModalCompartir(link, text);
}

function _mostrarModalCompartir(link, text) {
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) { alert(text); return; }
    overlay.innerHTML = `
    <div class="modal-content" style="max-width:400px;width:95%;text-align:center">
        <h3 style="font-weight:800;margin-bottom:10px">
            <i class="fas fa-share-alt" style="color:var(--primary)"></i> Compartir vaquita
        </h3>
        <p style="font-size:13px;color:var(--text-light);margin-bottom:14px">
            Copiá el link y compartilo por WhatsApp, mensaje o donde quieras
        </p>
        <input type="text" id="linkCompartirInput" class="form-control" value="${link}" readonly
            style="text-align:center;margin-bottom:14px" onclick="this.select()">
        <div style="display:flex;gap:10px">
            <button class="btn btn-outline" style="flex:1"
                onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none'">Cerrar</button>
            <button class="btn btn-primary" style="flex:1" onclick="_copiarLinkFallback()">
                <i class="fas fa-copy"></i> Copiar
            </button>
        </div>
    </div>`;
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('linkCompartirInput')?.select(), 100);
}

function _copiarLinkFallback() {
    const input = document.getElementById('linkCompartirInput');
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 99999);
    try {
        const ok = document.execCommand('copy');
        showToast(ok ? 'Link copiado ✅' : 'Seleccionado. Copiá con Ctrl+C', ok ? 'success' : 'info');
    } catch (e) {
        showToast('Seleccionado. Copiá con Ctrl+C', 'info');
    }
}

// ============================================
// CERRAR VAQUITA
// ============================================

async function cerrarVaquita(vaquitaId) {
    if (!confirm('¿Cerrar esta vaquita? Ya no se podrán agregar aportes.')) return;
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        const doc = await db.collection(COL.VAQUITAS).doc(vaquitaId).get();
        if (doc.data()?.creadorId !== user.uid) {
            showToast('Solo el creador puede cerrarla','warning'); return;
        }
        await db.collection(COL.VAQUITAS).doc(vaquitaId).update({
            activa:false, estado:'cerrada', cerradoAt:new Date().toISOString()
        });
        document.getElementById('vaquitaDetalleOverlay').style.display = 'none';
        showToast('Vaquita cerrada','info');
        cargarVaquitas();
    } catch(err) { showToast(`Error: ${err.message}`,'error'); }
}

// ============================================
// CREAR VAQUITA
// ============================================

function abrirModalVaquita() {
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) return;
    const hoy = new Date().toISOString().split('T')[0];

    overlay.innerHTML = `
    <div class="modal-content" style="max-width:440px;width:95%">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2 style="margin:0;font-size:20px;font-weight:800">
                <i class="fas fa-hand-holding-heart" style="color:var(--primary)"></i> Nueva Vaquita
            </h2>
            <button onclick="document.getElementById('vaquitaDetalleOverlay').style.display='none'"
                style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-light)">✕</button>
        </div>

        <div class="form-group">
            <label class="form-label">Tipo de vaquita</label>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
                ${TIPOS_VAQUITA.map(t => `
                <button type="button" onclick="seleccionarTipoVaquita('${t.id}',this)"
                    data-tipo="${t.id}"
                    style="padding:10px 4px;border:2px solid var(--border);border-radius:12px;background:white;cursor:pointer;text-align:center;transition:all 0.2s">
                    <div style="font-size:22px">${t.icono}</div>
                    <div style="font-size:10px;font-weight:700;margin-top:2px">${t.nombre}</div>
                </button>`).join('')}
            </div>
            <input type="hidden" id="vaquitaTipo">
        </div>

        <div class="form-group">
            <label class="form-label">Descripción *</label>
            <input type="text" id="vaquitaDescripcion" class="form-control"
                placeholder="Ej: Asado del domingo en lo de Juan">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
                <label class="form-label">Monto objetivo ($)</label>
                <input type="number" id="vaquitaMonto" class="form-control"
                    placeholder="0 = sin objetivo" step="100" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">Fecha del evento</label>
                <input type="date" id="vaquitaFecha" class="form-control" min="${hoy}">
            </div>
        </div>

        <button class="btn btn-primary" id="crearVaquitaBtn" onclick="crearVaquita()"
            style="width:100%;padding:14px;font-size:15px">
            <i class="fas fa-plus"></i> Crear Vaquita
        </button>
    </div>`;
    overlay.style.display = 'flex';
}

function seleccionarTipoVaquita(tipo, btn) {
    document.querySelectorAll('[data-tipo]').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background  = 'white';
    });
    btn.style.borderColor = 'var(--primary)';
    btn.style.background  = 'rgba(224,0,0,0.05)';
    const input = document.getElementById('vaquitaTipo');
    if (input) input.value = tipo;
}

async function crearVaquita() {
    const tipo  = document.getElementById('vaquitaTipo')?.value;
    const desc  = document.getElementById('vaquitaDescripcion')?.value?.trim();
    const monto = parseFloat(document.getElementById('vaquitaMonto')?.value) || 0;
    const fecha = document.getElementById('vaquitaFecha')?.value;

    if (!tipo)  { showToast('Seleccioná un tipo de vaquita','warning'); return; }
    if (!desc)  { showToast('Escribí una descripción','warning');       return; }
    if (!fecha) { showToast('Elegí una fecha para el evento','warning'); return; }

    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para crear una vaquita','warning'); return; }

    const btn = document.getElementById('crearVaquitaBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...'; }

    try {
        await db.collection(COL.VAQUITAS).add({
            creadorId:      user.uid,
            creadorEmail:   user.email,
            tipo, descripcion: desc,
            montoTotal:     monto,
            montoRecaudado: 0,
            fecha,
            participantes:  [],
            activa:         true,
            estado:         'abierta',
            createdAt:      new Date().toISOString(),
            updatedAt:      new Date().toISOString()
        });

        document.getElementById('vaquitaDetalleOverlay').style.display = 'none';
        showToast('✅ ¡Vaquita creada! Compartila con tus amigos.','success');
        cargarVaquitas();
    } catch (err) {
        console.error('crearVaquita:', err);
        showToast(`Error: ${err.message}`,'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Crear Vaquita'; }
    }
}

// ============================================
// OFERTAS DE COMIDAS
// ============================================

async function cargarOfertasComidas() {
    const container = document.getElementById('ofertasComidasGrid');
    if (!container) return;

    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-light)">
        <i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary)"></i></div>`;

    try {
        const snap = await db.collection(COL.PERFILES_COMERCIOS).get();
        const ofertas = [];
        const CATS = ['Comidas','Bebidas','Empanadas','Postres','Pizzas','Hamburguesas','Panadería'];

        await Promise.all(snap.docs.map(async cDoc => {
            const comercio = cDoc.data();
            if (!comercio.activo && comercio.activo !== undefined) return;
            const oSnap = await db.collection(COL.PERFILES_COMERCIOS).doc(cDoc.id)
                .collection(COL.OFERTAS).where('activo','==',true).get();
            oSnap.forEach(o => {
                const d = o.data();
                if (CATS.some(c => (d.categoria||'').includes(c))) {
                    ofertas.push({ id:o.id, comercioId:cDoc.id, comercioNombre:comercio.nombre||'Comercio', ...d });
                }
            });
        }));

        if (ofertas.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light)">
                <p>No hay ofertas de comida disponibles aún</p></div>`;
            return;
        }

        const emojiMap = { Empanadas:'🥟',Bebidas:'🥤',Comidas:'🍗',Postres:'🍰',Pizzas:'🍕',Hamburguesas:'🍔',Panadería:'🥖' };
        container.innerHTML = ofertas.slice(0,8).map(o => `
        <div class="oferta-comida-card" onclick="if(typeof abrirTienda==='function')abrirTienda('${o.comercioId}')">
            <div style="font-size:32px;text-align:center;margin-bottom:6px">${emojiMap[o.categoria]||'🍽️'}</div>
            <h4 style="margin:0 0 2px;font-weight:700;font-size:13px;line-height:1.2">${o.nombre}</h4>
            <p style="font-size:11px;color:var(--text-light);margin:0 0 4px">${o.comercioNombre}</p>
            <p style="font-size:15px;font-weight:800;color:var(--primary);margin:0">$${(o.precio||0).toFixed(2)}</p>
        </div>`).join('');
    } catch(err) {
        // Si esto tira "Missing or insufficient permissions" es el mismo problema
        // de reglas de Firestore descripto en firestore.rules — revisalo primero.
        console.error('cargarOfertasComidas:', err);
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-light)"><p>Error al cargar ofertas</p></div>`;
    }
}

// ============================================
// DEEP LINK
// ============================================

function checkVaquitaDeepLink() {
    const vid = new URLSearchParams(location.search).get('vaquita');
    if (!vid) return;
    auth.onAuthStateChanged(user => {
        if (user) setTimeout(() => verVaquita(vid), 900);
    });
}

// ============================================
// INIT
// ============================================

function initVaquitas() {
    cargarVaquitas();
    cargarOfertasComidas();
    checkVaquitaDeepLink();
}

// ============================================
// EXPORTS
// ============================================
window.initVaquitas          = initVaquitas;
window.cargarVaquitas        = cargarVaquitas;
window.verVaquita            = verVaquita;
window.aportarVaquita        = aportarVaquita;
window.confirmarAporte       = confirmarAporte;
window.crearVaquita          = crearVaquita;
window.abrirModalVaquita     = abrirModalVaquita;
window.seleccionarTipoVaquita= seleccionarTipoVaquita;
window.compartirVaquita      = compartirVaquita;
window._mostrarModalCompartir= _mostrarModalCompartir;
window._copiarLinkFallback   = _copiarLinkFallback;
window.cerrarVaquita         = cerrarVaquita;
window.cargarOfertasComidas  = cargarOfertasComidas;

console.log('✅ vaquitas.js V5 cargado (compartir corregido)');