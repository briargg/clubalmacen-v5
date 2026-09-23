// ============================================
// CLUBALMACÉN V5 – scoring.js (CON IMÁGENES Y CORRECCIONES)
// ============================================

const SCORING_CONFIG = {
    aliasClubAlmacen: 'sariluh16.mp',
    recompensasCliente: [
        { scoring:0,    tipo:'acceso', nombre:'Compras en almacén',      icono:'🛒', gratis:true,  requiereCredito:false },
        { scoring:300,  tipo:'acceso', nombre:'Verdulería y carnicería', icono:'🥦', gratis:true,  requiereCredito:false },
        { scoring:500,  tipo:'regalo', nombre:'Pava eléctrica',          icono:'☕', gratis:true,  requiereCredito:false, descripcion:'¡Gratis por tu scoring!' },
        { scoring:800,  tipo:'regalo', nombre:'Freidora de aire',        icono:'🍟', gratis:true,  requiereCredito:false, descripcion:'¡Gratis por tu scoring!' },
        { scoring:1000, tipo:'credito',nombre:'Televisor LED',           icono:'📺', gratis:false, requiereCredito:true,  descripcion:'Solicitá tu crédito' },
        { scoring:1000, tipo:'credito',nombre:'Heladera',                icono:'🧊', gratis:false, requiereCredito:true,  descripcion:'Solicitá tu crédito' },
        { scoring:1200, tipo:'credito',nombre:'Celular',                 icono:'📱', gratis:false, requiereCredito:true,  descripcion:'Solicitá tu crédito' },
        { scoring:1500, tipo:'credito',nombre:'Electrodomésticos premium',icono:'🏠', gratis:false, requiereCredito:true,  descripcion:'Solicitá tu crédito' },
    ],
    recompensasComerciante: [
        { ventas:0,       tipo:'acceso', nombre:'Plataforma básica',      icono:'🏪', requiereCredito:false },
        { ventas:100000,  tipo:'acceso', nombre:'Tienda online completa', icono:'🛒', requiereCredito:false },
        { ventas:300000,  tipo:'credito',nombre:'Balanza comercial',      icono:'⚖️', requiereCredito:true  },
        { ventas:500000,  tipo:'credito',nombre:'Heladera mostrador',     icono:'🧊', requiereCredito:true  },
        { ventas:800000,  tipo:'credito',nombre:'Freezer vertical',       icono:'❄️', requiereCredito:true  },
        { ventas:1200000, tipo:'credito',nombre:'Equipamiento completo',  icono:'🏭', requiereCredito:true  },
    ],
};

window.SCORING_CONFIG = SCORING_CONFIG;

async function sumarScoringPorPago(userId, montoPago, rol) {
    if (!userId || !montoPago) return;
    const puntos = Math.max(10, Math.floor(montoPago/100));
    try {
        const ref = db.collection(COL.USERS).doc(userId).collection(COL.SCORING).doc('data');
        const doc = await ref.get();
        const actual = doc.exists ? (doc.data().score||300) : 300;
        const nuevo  = actual + puntos;
        const cat    = nuevo>=1200?'high':nuevo>=800?'medium':nuevo>=500?'standard':'low';
        await ref.set({ score:nuevo, category:cat, updatedAt:now(), _lastUpdate:now(), _lastPoints:puntos }, { merge:true });
        _checkNuevasRecompensas(userId, actual, nuevo);
    } catch(e) { console.warn('sumarScoring:', e); }
}

async function sumarVentasComerciante(comercianteId, monto) {
    if (!comercianteId || !monto) return;
    try {
        const ref = db.collection(COL.USERS).doc(comercianteId).collection(COL.SCORING).doc('data');
        const doc = await ref.get();
        const actual = doc.exists ? (doc.data().ventasAcumuladas||0) : 0;
        const nuevo  = actual + monto;
        await ref.set({ ventasAcumuladas:nuevo, updatedAt:now() }, { merge:true });
        _checkNuevasRecompensasComerciante(comercianteId, actual, nuevo);
    } catch(e) { console.warn('sumarVentas:', e); }
}

function _checkNuevasRecompensas(userId, anterior, nuevo) {
    SCORING_CONFIG.recompensasCliente.forEach(r => {
        if (anterior < r.scoring && nuevo >= r.scoring) {
            if (typeof crearNotificacion==='function')
                crearNotificacion(userId, `🎉 ¡Desbloqueaste "${r.nombre}"! ${r.descripcion||''}`, 'success','fa-trophy','green');
            if (typeof showToast==='function')
                showToast(`🎉 ¡Nuevo beneficio desbloqueado: ${r.nombre}!`, 'success', 6000);
        }
    });
}

function _checkNuevasRecompensasComerciante(cId, anterior, nuevo) {
    SCORING_CONFIG.recompensasComerciante.forEach(r => {
        if (anterior < r.ventas && nuevo >= r.ventas) {
            if (typeof crearNotificacion==='function')
                crearNotificacion(cId, `🎉 ¡Alcanzaste $${r.ventas.toLocaleString('es-AR')} en ventas! Desbloqueaste "${r.nombre}"`, 'success','fa-trophy','green');
        }
    });
}

function renderScoringDetalle(userId, rol) {
    const containerId = rol==='comerciante' ? 'scoringDetalleContainerCom' : 'scoringDetalleContainer';
    const container   = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary)"></i></div>';
    db.collection(COL.USERS).doc(userId).collection(COL.SCORING).doc('data').get()
        .then(doc => {
            const d = doc.exists ? doc.data() : { score:300, ventasAcumuladas:0 };
            container.innerHTML = rol==='comerciante'
                ? _renderScoringCom(d.score||300, d.ventasAcumuladas||0)
                : _renderScoringCliente(d.score||300);
        }).catch(e => { container.innerHTML = '<div class="no-items">Error al cargar</div>'; });
}

function _renderScoringCliente(score) {
    const niveles = [{min:0,max:499,n:'Básico',c:'#3498db',i:'⭐'},{min:500,max:799,n:'Confianza',c:'#f39c12',i:'⭐⭐'},{min:800,max:1199,n:'Plus',c:'#9b59b6',i:'⭐⭐⭐'},{min:1200,max:9999,n:'Premium',c:'#e00000',i:'👑'}];
    const nivel = niveles.find(n=>score>=n.min&&score<=n.max)||niveles[0];
    const sig   = niveles.find(n=>n.min>score);
    const pct   = sig ? Math.min(((score-nivel.min)/(sig.min-nivel.min))*100,100) : 100;
    const items = SCORING_CONFIG.recompensasCliente.map(r => {
        const ok   = score >= r.scoring;
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:${ok?'rgba(0,200,83,0.05)':'#f8f8f8'};border-radius:12px;border:1px solid ${ok?'rgba(0,200,83,0.2)':'var(--border)'}">
            <span style="font-size:26px">${r.icono}</span>
            <div style="flex:1">
                <div style="font-weight:700;font-size:14px;color:${ok?'var(--text-dark)':'#999'}">${r.nombre}</div>
                <div style="font-size:12px;color:${ok?'var(--success)':'var(--text-light)'}">${ok?(r.gratis?'✅ ¡Desbloqueado!':'✅ Crédito disponible'):`🔒 Requiere ${r.scoring} pts`}</div>
                ${r.descripcion&&ok?`<div style="font-size:11px;color:var(--primary);font-weight:600">${r.descripcion}</div>`:''}
            </div>
            ${ok&&r.requiereCredito?`<button onclick="solicitarCredito('${r.nombre}')" class="btn btn-primary" style="font-size:11px;padding:6px 12px;white-space:nowrap">Solicitar</button>`:''}
            ${ok&&r.gratis&&r.tipo==='regalo'?`<button onclick="reclamarRegalo('${r.nombre}')" class="btn btn-secondary" style="font-size:11px;padding:6px 10px">Reclamar</button>`:''}
        </div>`;
    }).join('');
    return `
    <div style="background:var(--gradient-primary);border-radius:20px;padding:24px;color:white;margin-bottom:20px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.1);border-radius:50%"></div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.8">Nivel actual</div>
        <div style="font-size:28px;font-weight:800;margin:4px 0">${nivel.i} ${nivel.n}</div>
        <div style="font-size:44px;font-weight:800;line-height:1">${score}</div>
        <div style="font-size:13px;opacity:0.8">puntos de scoring</div>
        ${sig?`<div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>Hacia ${sig.n}</span><span>${score}/${sig.min}</span></div>
            <div style="height:8px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:white;border-radius:4px"></div></div>
            <div style="font-size:12px;opacity:0.8;margin-top:4px">Faltan ${sig.min-score} puntos</div>
        </div>`:'<div style="margin-top:12px;font-weight:700">🏆 ¡Nivel máximo!</div>'}
    </div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">Tus beneficios</h3>
    <div style="display:flex;flex-direction:column;gap:10px">${items}</div>
    <div style="margin-top:18px;background:#f8f8f8;border-radius:12px;padding:14px;font-size:13px;color:var(--text-light)">
        <strong style="color:var(--text-dark)">¿Cómo subo mi scoring?</strong><br>
        Cada $100 pagados a tiempo = 1 punto. Cada pago suma mínimo 10 puntos.
    </div>`;
}

function _renderScoringCom(score, ventas) {
    const items = SCORING_CONFIG.recompensasComerciante.map(r => {
        const ok = ventas >= r.ventas;
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:${ok?'rgba(0,200,83,0.05)':'#f8f8f8'};border-radius:12px;border:1px solid ${ok?'rgba(0,200,83,0.2)':'var(--border)'}">
            <span style="font-size:26px">${r.icono}</span>
            <div style="flex:1">
                <div style="font-weight:700;font-size:14px;color:${ok?'var(--text-dark)':'#999'}">${r.nombre}</div>
                <div style="font-size:12px;color:${ok?'var(--success)':'var(--text-light)'}">${ok?'✅ Disponible':`🔒 Requiere $${r.ventas.toLocaleString('es-AR')} en ventas`}</div>
            </div>
            ${ok&&r.requiereCredito?`<button onclick="solicitarCredito('${r.nombre}')" class="btn btn-primary" style="font-size:11px;padding:6px 12px">Solicitar</button>`:''}
        </div>`;
    }).join('');
    return `
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:20px;padding:24px;color:white;margin-bottom:20px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.7">Ventas acumuladas</div>
        <div style="font-size:36px;font-weight:800;margin:6px 0">$${ventas.toLocaleString('es-AR')}</div>
        <div style="font-size:13px;opacity:0.7">Scoring: ${score} pts</div>
    </div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">Tus beneficios</h3>
    <div style="display:flex;flex-direction:column;gap:10px">${items}</div>`;
}

// ============================================
// CATÁLOGO DE ELECTRODOMÉSTICOS (CON IMAGEN Y BOTONES UNIFICADOS)
// ============================================

async function loadCatalogoElectro(isAdmin) {
    const container = document.getElementById('catalogoElectroContainer');
    if (!container) return;
    container.innerHTML = '<div class="no-items"><i class="fas fa-spinner fa-spin"></i> Cargando catálogo...</div>';
    try {
        const snap = await db.collection('catalogoElectro').get();
        const items = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.scoring||0)-(b.scoring||0));
        
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
        
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">`;
        html += items.map(item=>`
            <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow)">
                <div style="background:var(--gradient-primary);padding:18px;text-align:center;color:white;font-size:38px">
                    ${item.imagen && item.imagen !== '📦' ? `<img src="${item.imagen}" style="width:80px;height:80px;object-fit:contain;border-radius:8px;background:white">` : (item.icono||'📦')}
                </div>
                <div style="padding:12px">
                    <div style="font-weight:700;font-size:13px;margin-bottom:3px">${item.nombre}</div>
                    <div style="font-size:11px;color:var(--text-light);margin-bottom:6px">${item.descripcion||''}</div>
                    ${item.precio?`<div style="font-size:14px;font-weight:700;color:var(--primary);margin-bottom:4px">$${parseFloat(item.precio).toLocaleString('es-AR')}</div>`:''}
                    
                    <!-- CORRECCIÓN: Si item.scoring no existe, muestra 0 -->
                    <div style="font-size:11px;background:rgba(224,0,0,0.07);color:var(--primary);padding:3px 8px;border-radius:8px;display:inline-block;margin-bottom:6px">🔒 ${item.scoring || 0} pts</div>
                    ${item.gratis?'<div style="font-size:11px;background:rgba(0,200,83,0.1);color:var(--success);padding:3px 8px;border-radius:8px;display:inline-block;margin-left:4px">🎁 ¡Gratis!</div>':''}
                    
                    ${isAdmin ? `
                    <div style="display:flex;gap:4px;margin-top:8px">
                        <button onclick="editarElectro('${item.id}')" class="btn btn-outline" style="flex:1;font-size:11px;padding:5px">Editar</button>
                        <button onclick="eliminarElectro('${item.id}')" class="btn btn-outline" style="font-size:11px;padding:5px;color:var(--primary)">🗑️</button>
                    </div>` : `
                    <!-- BOTONES UNIFICADOS PARA CLIENTES Y COMERCIANTES -->
                    <div style="display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px">
                        ${item.gratis ? `
                        <button onclick="reclamarRegalo('${item.nombre.replace(/'/g,"\\'")}')" class="btn btn-secondary" style="width:100%;font-size:11px;padding:7px">
                            🎁 Reclamar gratis
                        </button>` : `
                        <button onclick="solicitarCredito('${item.nombre.replace(/'/g,"\\'")}')" class="btn btn-primary" style="width:100%;font-size:11px;padding:7px">
                            💳 Comprar con crédito
                        </button>
                        <button onclick="solicitarFiado('${item.nombre.replace(/'/g,"\\'")}', ${item.precio||0})" class="btn btn-outline" style="width:100%;font-size:11px;padding:7px;border-color:var(--success);color:var(--success)">
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

// ============================================
// SOLICITUD DE CRÉDITO Y FIADO
// ============================================

async function solicitarCredito(nombreProducto) {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para solicitar crédito','warning'); return; }
    const overlay = document.getElementById('vaquitaDetalleOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.innerHTML = `
    <div class="modal-content" style="max-width:440px;width:95%">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2 style="margin:0;font-size:18px;font-weight:800"><i class="fas fa-credit-card" style="color:var(--primary)"></i> Solicitar Crédito</h2>
            <button onclick="this.closest('[id]').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
        </div>
        <div style="background:rgba(224,0,0,0.05);border-radius:12px;padding:14px;margin-bottom:16px;font-size:14px">
            <strong>${nombreProducto}</strong><br>
            <span style="color:var(--text-light);font-size:13px">Tu solicitud será revisada en 24hs hábiles.</span>
        </div>
        <div class="form-group">
            <label class="form-label">Número de DNI</label>
            <input type="text" id="solicitudDNI" class="form-control" placeholder="12345678">
        </div>
        <div class="form-group">
            <label class="form-label">Foto del DNI (frente)</label>
            <div onclick="document.getElementById('dniInput').click()" style="border:2px dashed var(--border);border-radius:12px;padding:20px;text-align:center;cursor:pointer;color:var(--text-light)">
                <i class="fas fa-id-card" style="font-size:28px;display:block;margin-bottom:8px"></i>
                <span id="dniFileName">Tocá para subir foto</span>
            </div>
            <input type="file" id="dniInput" accept="image/*" style="display:none"
                onchange="document.getElementById('dniFileName').textContent=this.files[0]?.name||'Seleccionado'">
        </div>
        <div class="form-group">
            <label class="form-label">Factura de servicio (agua, luz, gas)</label>
            <div onclick="document.getElementById('facturaInput').click()" style="border:2px dashed var(--border);border-radius:12px;padding:20px;text-align:center;cursor:pointer;color:var(--text-light)">
                <i class="fas fa-file-invoice" style="font-size:28px;display:block;margin-bottom:8px"></i>
                <span id="facturaFileName">Tocá para subir factura</span>
            </div>
            <input type="file" id="facturaInput" accept="image/*,application/pdf" style="display:none"
                onchange="document.getElementById('facturaFileName').textContent=this.files[0]?.name||'Seleccionado'">
        </div>
        <button class="btn btn-primary" onclick="confirmarSolicitudCredito('${nombreProducto.replace(/'/g,"\\'")}','${user.uid}','${user.email}')" style="width:100%;padding:14px">
            <i class="fas fa-paper-plane"></i> Enviar solicitud
        </button>
    </div>`;
}

async function confirmarSolicitudCredito(nombreProducto, userId, userEmail) {
    const dni = document.getElementById('solicitudDNI')?.value?.trim();
    if (!dni) { showToast('Ingresá tu número de DNI','warning'); return; }
    try {
        await db.collection('solicitudesCredito').add({
            userId, userEmail, producto:nombreProducto, dni,
            estado:'pendiente', createdAt:now(), revisadoAt:null, aprobado:null, nota:''
        });
        const overlay = document.getElementById('vaquitaDetalleOverlay');
        if (overlay) overlay.style.display = 'none';
        showToast('✅ Solicitud enviada. Te avisamos en 24hs hábiles.','success',6000);
        if (typeof crearNotificacion==='function')
            crearNotificacion(userId,`📋 Solicitud de crédito para "${nombreProducto}" recibida. Revisión en 24hs.`,'info','fa-hourglass-half','orange');
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function solicitarFiado(nombreProducto, precio) {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para solicitar fiado','warning'); return; }
    if (!confirm(`¿Solicitar fiado para "${nombreProducto}" ($${precio.toFixed(2)})?\nEl comerciante deberá habilitar tu crédito.`)) return;
    try {
        await db.collection('solicitudesFiado').add({
            userId: user.uid, userEmail: user.email, producto: nombreProducto, precio,
            estado:'pendiente', createdAt:now()
        });
        showToast('📋 Solicitud de fiado enviada. El comerciante te contactará.','info',5000);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function reclamarRegalo(nombreProducto) {
    const user = firebase.auth().currentUser;
    if (!user) { showToast('Iniciá sesión para reclamar','warning'); return; }
    if (!confirm(`¿Reclamar tu ${nombreProducto} gratis? Club Almacén se va a poner en contacto.`)) return;
    try {
        await db.collection('reclamosRegalo').add({ userId:user.uid, userEmail:user.email, producto:nombreProducto, estado:'pendiente', createdAt:now() });
        showToast(`✅ Reclamo enviado. ¡Te contactamos pronto!`,'success',5000);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

// ============================================
// ADMINISTRACIÓN DEL CATÁLOGO (CON IMAGEN)
// ============================================

function mostrarFormElectro(item) {
    const c = document.getElementById('formElectroContainer');
    if (!c) return;
    c.innerHTML = `<div style="background:#f8f8f8;border-radius:14px;padding:18px;margin-bottom:16px">
        <input type="hidden" id="electoId" value="${item?.id||''}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label class="form-label">Nombre</label><input type="text" id="electroNombre" class="form-control" value="${item?.nombre||''}" placeholder="Ej: Televisor LED"></div>
            
            <!-- CAMPO DE IMAGEN AGREGADO -->
            <div class="form-group">
                <label class="form-label">Imagen del producto</label>
                <div style="display:flex;gap:10px;align-items:center">
                    <input type="file" id="electroImagenInput" accept="image/*" style="display:none" onchange="previewElectroImagen(event)">
                    <button class="btn btn-outline" onclick="document.getElementById('electroImagenInput').click()" style="font-size:12px;padding:6px 12px">
                        <i class="fas fa-image"></i> Seleccionar foto
                    </button>
                    <div id="electroImagenPreview" style="width:40px;height:40px;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden">
                        ${item?.imagen ? `<img src="${item.imagen}" style="width:100%;height:100%;object-fit:cover">` : '📷'}
                    </div>
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label class="form-label">Precio ($)</label><input type="number" id="electroPrecio" class="form-control" value="${item?.precio||''}"></div>
            <div class="form-group"><label class="form-label">Scoring requerido</label><input type="number" id="electroScoring" class="form-control" value="${item?.scoring||500}"></div>
        </div>
        <div class="form-group"><label class="form-label">Descripción</label><input type="text" id="electroDesc" class="form-control" value="${item?.descripcion||''}"></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;margin-bottom:12px">
            <input type="checkbox" id="electroGratis" ${item?.gratis?'checked':''}> ¿Es gratis por scoring?
        </label>
        <div style="display:flex;gap:10px">
            <button class="btn btn-primary" onclick="guardarElectro()" style="flex:1"><i class="fas fa-save"></i> Guardar</button>
            <button class="btn btn-outline" onclick="document.getElementById('formElectroContainer').innerHTML=''" style="padding:12px 16px">Cancelar</button>
        </div>
    </div>`;
}

// NUEVA FUNCIÓN PARA PREVISUALIZAR LA IMAGEN
window.previewElectroImagen = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('electroImagenPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
            window._electroTempImage = e.target.result;
        }
    };
    reader.readAsDataURL(file);
};

async function guardarElectro() {
    const id = document.getElementById('electoId')?.value;
    const data = { 
        nombre:document.getElementById('electroNombre')?.value?.trim(), 
        icono:document.getElementById('electroIcono')?.value?.trim()||'📦', 
        imagen: window._electroTempImage || document.querySelector('#electroImagenPreview img')?.src || '📦',
        precio:parseFloat(document.getElementById('electroPrecio')?.value)||0, 
        scoring:parseInt(document.getElementById('electroScoring')?.value)||500, 
        descripcion:document.getElementById('electroDesc')?.value?.trim()||'', 
        gratis:document.getElementById('electroGratis')?.checked||false, 
        updatedAt:now() 
    };
    if (!data.nombre) { showToast('Ingresá el nombre','warning'); return; }
    try {
        if (id) { await db.collection('catalogoElectro').doc(id).update(data); }
        else { data.createdAt=now(); await db.collection('catalogoElectro').add(data); }
        showToast('Electrodoméstico guardado ✅','success');
        document.getElementById('formElectroContainer').innerHTML='';
        window._electroTempImage = null; // Limpiar
        loadCatalogoElectro(true);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function eliminarElectro(id) { 
    if(!confirm('¿Eliminar este producto del catálogo?')) return; 
    await db.collection('catalogoElectro').doc(id).delete(); 
    showToast('Eliminado','info'); 
    loadCatalogoElectro(true); 
}

async function editarElectro(id) { 
    const d=await db.collection('catalogoElectro').doc(id).get(); 
    if(d.exists) mostrarFormElectro({id,...d.data()}); 
}

async function loadSolicitudesCredito() {
    const container = document.getElementById('solicitudesCreditoList');
    if (!container) return;
    try {
        const snap = await db.collection('solicitudesCredito').where('estado','==','pendiente').get();
        if (snap.empty) { container.innerHTML='<div class="no-items">Sin solicitudes pendientes ✅</div>'; return; }
        container.innerHTML = snap.docs.map(doc => {
            const s = doc.data();
            return `<div class="purchase-item" style="flex-direction:column;align-items:flex-start;gap:10px">
                <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px">
                    <div><strong>${s.userEmail}</strong>
                        <div style="font-size:13px;color:var(--text-light)">${s.producto} · DNI: ${s.dni}</div>
                        <div style="font-size:12px;color:var(--text-light)">${new Date(s.createdAt).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                            onclick="resolverSolicitud('${doc.id}','${s.userId}',true,'${s.producto.replace(/'/g,"\\'")}')">✅ Aprobar</button>
                        <button class="btn btn-outline" style="font-size:12px;padding:6px 10px;color:var(--primary)"
                            onclick="resolverSolicitud('${doc.id}','${s.userId}',false,'${s.producto.replace(/'/g,"\\'")}')">❌ Rechazar</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML='<div class="no-items">Error al cargar solicitudes</div>'; }
}

async function resolverSolicitud(solicitudId, userId, aprobado, producto) {
    const nota = aprobado ? '' : (prompt('Motivo del rechazo:') || 'No aprobado');
    try {
        await db.collection('solicitudesCredito').doc(solicitudId).update({
            estado:aprobado?'aprobado':'rechazado', aprobado, nota, revisadoAt:now()
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

// ============================================
// EXPORTS
// ============================================

window.sumarScoringPorPago    = sumarScoringPorPago;
window.sumarVentasComerciante = sumarVentasComerciante;
window.renderScoringDetalle   = renderScoringDetalle;
window.solicitarCredito       = solicitarCredito;
window.confirmarSolicitudCredito = confirmarSolicitudCredito;
window.solicitarFiado         = solicitarFiado;
window.reclamarRegalo         = reclamarRegalo;
window.loadSolicitudesCredito = loadSolicitudesCredito;
window.resolverSolicitud      = resolverSolicitud;
window.loadCatalogoElectro    = loadCatalogoElectro;
window.mostrarFormElectro     = mostrarFormElectro;
window.guardarElectro         = guardarElectro;
window.eliminarElectro        = eliminarElectro;
window.editarElectro          = editarElectro;

console.log('✅ scoring.js V5 cargado (con imágenes y correcciones)');