// ============================================
// CLUBALMACÉN – store.js
// Perfil comerciante · Catálogo · Tiendas
// ============================================

// ✅ Usar var en lugar de const para evitar error de redeclaración
if (typeof Store === 'undefined') {
    var Store = {
        perfil: null,
        ofertas: [],
        carrito: [],
        carritoTiendaId: null,
        carritoTiendaNombre: '',
        ofertaEditando: null,
        tiendaActual: null,
    };
} else {
    console.log('Store ya existe, usando el existente');
}

// ============================================
// PERFIL DEL COMERCIANTE
// ============================================

async function loadPerfilComerciante(uid) {
    if (!uid) return;
    try {
        const doc = await db.collection('perfilesComercios').doc(uid).get();
        if (doc.exists) {
            Store.perfil = { id: uid, ...doc.data() };
        } else {
            Store.perfil = {
                id: uid,
                nombre: '',
                tipo: '',
                descripcion: '',
                direccion: '',
                telefono: '',
                horario: '',
                logo: '',
                cover: '',
                abierto: true,
                envio: false,
                costoEnvio: 0,
                montoEnvioGratis: 0,
                envioGratis: false,
                activo: true,
                createdAt: new Date().toISOString()
            };
        }
        renderPerfilEditor();
    } catch (e) {
        console.error('Error cargando perfil:', e);
    }
}

function renderPerfilEditor() {
    const p = Store.perfil || {};
    const container = document.getElementById('perfilEditorContainer');
    if (!container) return;

    container.innerHTML = `
    <div class="perfil-cover" id="perfilCoverPreview" onclick="document.getElementById('coverInput').click()" title="Cambiar portada">
        ${p.cover ? `<img src="${p.cover}" class="perfil-cover-img" id="coverImgPreview" style="display:block">` : `<div class="perfil-cover-placeholder"><i class="fas fa-image"></i><span>Tocá para agregar portada</span></div>`}
        <button class="perfil-cover-edit-btn" onclick="event.stopPropagation();document.getElementById('coverInput').click()"><i class="fas fa-camera"></i></button>
    </div>
    <input type="file" id="coverInput" accept="image/*" style="display:none" onchange="previewCover(event)">

    <div class="perfil-logo-area">
        <div class="perfil-logo-wrap" id="perfilLogoWrap" onclick="document.getElementById('logoInput').click()">
            ${p.logo ? `<img src="${p.logo}" id="logoImgPreview" style="width:100%;height:100%;object-fit:cover">` : `<span id="logoImgPreview" style="font-size:28px">🏪</span>`}
        </div>
        <input type="file" id="logoInput" accept="image/*" style="display:none" onchange="previewLogo(event)">
        <div class="perfil-name-row">
            <h2>${p.nombre || 'Tu comercio'}</h2>
            <div class="perfil-tipo">${p.tipo || 'Sin categoría'}</div>
        </div>
    </div>

    <div class="perfil-badges">
        <span class="perfil-badge ${p.abierto !== false ? 'open' : 'closed'}"><i class="fas fa-circle" style="font-size:8px"></i>${p.abierto !== false ? 'Abierto' : 'Cerrado'}</span>
        <span class="perfil-badge ${p.envio ? 'envio' : 'noenvio'}"><i class="fas fa-${p.envio ? 'motorcycle' : 'store'}"></i>${p.envio ? 'Con envío' : 'Solo retiro'}</span>
        ${p.envioGratis ? `<span class="perfil-badge envio"><i class="fas fa-gift"></i> Envío gratis +$${p.montoEnvioGratis}</span>` : ''}
    </div>

    <div class="perfil-form-grid">
        <div class="form-group full"><label class="form-label">Nombre del negocio *</label><input type="text" id="pNombre" class="form-control" placeholder="Almacén Don Pedro" value="${p.nombre || ''}"></div>
        <div class="form-group"><label class="form-label">Tipo</label><select id="pTipo" class="form-control">${['','Almacén','Verdulería','Carnicería','Panadería','Farmacia','Kiosco','Ferretería','Bazar','Otro'].map(t => `<option value="${t}" ${p.tipo===t?'selected':''}>${t||'Seleccionar...'}</option>`).join('')}</select></div>
        <div class="form-group full"><label class="form-label">Descripción</label><textarea id="pDesc" class="form-control" rows="2" placeholder="Ej: Almacén familiar con 20 años en el barrio.">${p.descripcion || ''}</textarea></div>
        <div class="form-group"><label class="form-label">Dirección</label><input type="text" id="pDireccion" class="form-control" placeholder="Av. San Martín 1234" value="${p.direccion || ''}"></div>
        <div class="form-group"><label class="form-label">Teléfono / WhatsApp</label><input type="tel" id="pTelefono" class="form-control" placeholder="11-1234-5678" value="${p.telefono || ''}"></div>
        <div class="form-group full"><label class="form-label">Horario</label><input type="text" id="pHorario" class="form-control" placeholder="Lun–Vie 8:00–20:00" value="${p.horario || ''}"></div>
    </div>

    <div style="background:#f8f8f8;border-radius:14px;padding:0 16px;margin-bottom:16px">
        <div class="toggle-switch-row"><div><div class="toggle-label"><i class="fas fa-store" style="color:var(--primary);margin-right:6px"></i> Comercio abierto</div><div class="toggle-sublabel">Los clientes pueden ver tu catálogo</div></div><label class="toggle-switch"><input type="checkbox" id="pAbierto" ${p.abierto!==false?'checked':''}><span class="toggle-slider"></span></label></div>
        <div class="toggle-switch-row"><div><div class="toggle-label"><i class="fas fa-motorcycle" style="color:#1565c0;margin-right:6px"></i> Servicio de envío</div><div class="toggle-sublabel">Tus clientes podrán solicitar entrega</div></div><label class="toggle-switch"><input type="checkbox" id="pEnvio" ${p.envio?'checked':''} onchange="toggleEnvioOptions()"><span class="toggle-slider"></span></label></div>
        <div id="envioOptions" style="display:${p.envio?'block':'none'};padding:10px 0">
            <div class="perfil-form-grid">
                <div class="form-group"><label class="form-label">Costo de envío ($)</label><input type="number" id="pCostoEnvio" class="form-control" placeholder="0" value="${p.costoEnvio||0}" step="50"></div>
                <div class="form-group"><label class="form-label">Monto mín. envío gratis</label><input type="number" id="pMontoEnvioGratis" class="form-control" placeholder="0" value="${p.montoEnvioGratis||0}" step="100"></div>
            </div>
        </div>
    </div>

    <button class="btn btn-primary" onclick="guardarPerfilComerciante()" style="width:100%"><i class="fas fa-save"></i> Guardar perfil</button>`;
}

function toggleEnvioOptions() {
    const envio = document.getElementById('pEnvio')?.checked;
    const opts = document.getElementById('envioOptions');
    if (opts) opts.style.display = envio ? 'block' : 'none';
}

function previewLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const wrap = document.getElementById('perfilLogoWrap');
        if (wrap) wrap.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
        if (Store.perfil) Store.perfil.logo = e.target.result;
    };
    reader.readAsDataURL(file);
}

function previewCover(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById('coverImgPreview');
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        if (Store.perfil) Store.perfil.cover = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function guardarPerfilComerciante() {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) { 
        if (typeof showToast === 'function') showToast('Debes iniciar sesión', 'warning'); 
        return; 
    }

    const nombre = document.getElementById('pNombre')?.value.trim();
    if (!nombre) { 
        if (typeof showToast === 'function') showToast('El nombre es obligatorio.', 'warning'); 
        return; 
    }

    const datos = {
        nombre,
        tipo: document.getElementById('pTipo')?.value || '',
        descripcion: document.getElementById('pDesc')?.value.trim() || '',
        direccion: document.getElementById('pDireccion')?.value.trim() || '',
        telefono: document.getElementById('pTelefono')?.value.trim() || '',
        horario: document.getElementById('pHorario')?.value.trim() || '',
        abierto: document.getElementById('pAbierto')?.checked ?? true,
        envio: document.getElementById('pEnvio')?.checked ?? false,
        costoEnvio: parseFloat(document.getElementById('pCostoEnvio')?.value || 0),
        montoEnvioGratis: parseFloat(document.getElementById('pMontoEnvioGratis')?.value || 0),
        envioGratis: parseFloat(document.getElementById('pMontoEnvioGratis')?.value || 0) > 0,
        logo: Store.perfil?.logo || '',
        cover: Store.perfil?.cover || '',
        activo: true,
        updatedAt: new Date().toISOString()
    };
    if (!Store.perfil?.createdAt) datos.createdAt = new Date().toISOString();

    try {
        await db.collection('perfilesComercios').doc(uid).set(datos, { merge: true });
        await db.collection('users').doc(uid).set({
            nombreComercio: datos.nombre,
            tipo: datos.tipo,
            role: 'comerciante',
            email: firebase.auth().currentUser?.email || '',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        Store.perfil = { id: uid, ...datos };
        if (typeof showToast === 'function') showToast('✅ Perfil guardado correctamente!', 'success');
        renderPerfilEditor();
        loadOfertasComerciante(uid);
        if (typeof loadTiendasParaCliente === 'function') loadTiendasParaCliente();
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error al guardar. Revisá tu conexión.', 'warning');
    }
}

// ============================================
// CATÁLOGO DE OFERTAS
// ============================================

async function loadOfertasComerciante(uid) {
    if (!uid) return;
    try {
        const snap = await db.collection('perfilesComercios').doc(uid).collection('ofertas').get();
        Store.ofertas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOfertasAdminList(uid);
    } catch (e) {
        Store.ofertas = [];
        renderOfertasAdminList(uid);
    }
}

function renderOfertasAdminList(uid) {
    const container = document.getElementById('ofertasAdminList');
    if (!container) return;

    if (Store.ofertas.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-light)"><i class="fas fa-tags" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px"></i><p>Todavía no tenés productos.</p><p>Usá "Nuevo producto" para empezar.</p></div>`;
        return;
    }

    container.innerHTML = Store.ofertas.map(o => `
    <div class="oferta-admin-item">
        <div class="oferta-admin-img">${o.imagen ? `<img src="${o.imagen}">` : '📦'}</div>
        <div class="oferta-admin-info"><h4>${o.nombre}</h4><p>${o.categoria || ''} · ${o.activo !== false ? '✅ Visible' : '🔴 Oculto'}</p></div>
        <div class="oferta-admin-price">$${parseFloat(o.precio||0).toLocaleString('es-AR')}</div>
        <div class="oferta-admin-actions">
            <button class="btn-icon edit" onclick="editarOferta('${o.id}')" title="Editar"><i class="fas fa-pen"></i></button>
            <button class="btn-icon toggle ${o.activo !== false ? '' : 'off'}" onclick="toggleOfertaActiva('${o.id}','${uid}')" title="${o.activo !== false ? 'Ocultar' : 'Mostrar'}"><i class="fas fa-eye${o.activo !== false ? '' : '-slash'}"></i></button>
            <button class="btn-icon delete" onclick="eliminarOferta('${o.id}','${uid}')" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
    </div>`).join('');
}

function showOfertaForm(ofertaData = null) {
    Store.ofertaEditando = ofertaData;
    const form = document.getElementById('ofertaFormContainer');
    if (!form) return;

    const o = ofertaData || {};
    form.innerHTML = `
    <div class="oferta-form">
        <h3 style="margin:0 0 14px;font-size:16px;font-weight:800"><i class="fas fa-${o.id ? 'pen' : 'plus-circle'}" style="color:var(--primary)"></i> ${o.id ? 'Editar producto' : 'Nuevo producto'}</h3>
        <div onclick="document.getElementById('ofertaImgInput').click()" style="cursor:pointer">
            ${o.imagen ? `<img src="${o.imagen}" class="oferta-img-preview" id="ofertaImgPreview" style="display:block">` : `<div class="oferta-img-placeholder" id="ofertaImgPlaceholder"><i class="fas fa-image"></i><span>Tocá para agregar foto</span></div><img src="" class="oferta-img-preview" id="ofertaImgPreview">`}
        </div>
        <input type="file" id="ofertaImgInput" accept="image/*" style="display:none" onchange="previewOfertaImg(event)">
        <div class="oferta-form-grid">
            <div class="form-group full"><label class="form-label">Nombre *</label><input type="text" id="oNombre" class="form-control" placeholder="Ej: Leche 1L" value="${o.nombre || ''}"></div>
            <div class="form-group full"><label class="form-label">Descripción</label><textarea id="oDesc" class="form-control" rows="2" placeholder="Detalles del producto">${o.descripcion || ''}</textarea></div>
            <div class="form-group"><label class="form-label">Precio ($) *</label><input type="number" id="oPrecio" class="form-control" placeholder="0.00" value="${o.precio || ''}" step="0.01"></div>
            <div class="form-group"><label class="form-label">Precio original</label><input type="number" id="oPrecioOriginal" class="form-control" placeholder="0.00" value="${o.precioOriginal || ''}" step="0.01"></div>
            <div class="form-group"><label class="form-label">Categoría</label><select id="oCategoria" class="form-control">${['Almacén','Verdulería','Carnicería','Panadería','Farmacia','Kiosco','Ferretería','Bebidas','Limpieza','Lácteos','Otro'].map(c => `<option value="${c}" ${o.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Stock</label><input type="number" id="oStock" class="form-control" placeholder="Vacío = ilimitado" value="${o.stock !== undefined ? o.stock : ''}"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:4px">
            <button class="btn btn-primary" onclick="guardarOferta('${o.id || ''}')" style="flex:1"><i class="fas fa-save"></i> ${o.id ? 'Actualizar' : 'Publicar'}</button>
            ${o.id ? `<button class="btn btn-outline" onclick="cancelarEdicionOferta()"><i class="fas fa-times"></i></button>` : ''}
        </div>
    </div>`;
}

function previewOfertaImg(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById('ofertaImgPreview');
        const ph = document.getElementById('ofertaImgPlaceholder');
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        if (ph) ph.style.display = 'none';
        if (!Store.ofertaEditando) Store.ofertaEditando = {};
        Store.ofertaEditando._imgBase64 = e.target.result;
    };
    reader.readAsDataURL(file);
}

function editarOferta(id) {
    const oferta = Store.ofertas.find(o => o.id === id);
    if (oferta) showOfertaForm(oferta);
}

function cancelarEdicionOferta() {
    showOfertaForm();
}

async function guardarOferta(existingId) {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) { 
        if (typeof showToast === 'function') showToast('Debes iniciar sesión', 'warning'); 
        return; 
    }

    const nombre = document.getElementById('oNombre')?.value.trim();
    const precio = parseFloat(document.getElementById('oPrecio')?.value || 0);
    if (!nombre || !precio) { 
        if (typeof showToast === 'function') showToast('Nombre y precio son obligatorios.', 'warning'); 
        return; 
    }

    const datos = {
        nombre,
        descripcion: document.getElementById('oDesc')?.value.trim() || '',
        precio,
        precioOriginal: parseFloat(document.getElementById('oPrecioOriginal')?.value || 0) || null,
        categoria: document.getElementById('oCategoria')?.value || 'Otro',
        stock: document.getElementById('oStock')?.value !== '' ? parseInt(document.getElementById('oStock').value) : null,
        imagen: Store.ofertaEditando?._imgBase64 || Store.ofertaEditando?.imagen || '',
        activo: true,
        updatedAt: new Date().toISOString()
    };

    try {
        const ref = db.collection('perfilesComercios').doc(uid).collection('ofertas');
        if (existingId) {
            await ref.doc(existingId).update(datos);
            if (typeof showToast === 'function') showToast('Producto actualizado.', 'success');
        } else {
            datos.createdAt = new Date().toISOString();
            await ref.add(datos);
            if (typeof showToast === 'function') showToast('Producto publicado.', 'success');
        }
        Store.ofertaEditando = null;
        await loadOfertasComerciante(uid);
        showOfertaForm();
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error al guardar.', 'warning');
    }
}

async function toggleOfertaActiva(id, uid) {
    const oferta = Store.ofertas.find(o => o.id === id);
    if (!oferta) return;
    try {
        await db.collection('perfilesComercios').doc(uid).collection('ofertas').doc(id).update({ activo: !oferta.activo });
        oferta.activo = !oferta.activo;
        renderOfertasAdminList(uid);
    } catch (e) { 
        if (typeof showToast === 'function') showToast('Error al actualizar.', 'warning'); 
    }
}

async function eliminarOferta(id, uid) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
        await db.collection('perfilesComercios').doc(uid).collection('ofertas').doc(id).delete();
        Store.ofertas = Store.ofertas.filter(o => o.id !== id);
        renderOfertasAdminList(uid);
        if (typeof showToast === 'function') showToast('Producto eliminado.', 'info');
    } catch (e) { 
        if (typeof showToast === 'function') showToast('Error al eliminar.', 'warning'); 
    }
}

// ============================================
// TIENDAS PARA CLIENTE
// ============================================

async function loadTiendasParaCliente() {
    const container = document.getElementById('tiendasGrid');
    if (!container) return;
    
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light)"><i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary)"></i><p style="margin-top:10px">Cargando comercios...</p></div>`;

    try {
        const snap = await db.collection('perfilesComercios').where('activo', '==', true).get();
        let tiendas = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.nombre);

        if (tiendas.length === 0) {
            const snap2 = await db.collection('perfilesComercios').where('nombre', '!=', '').get();
            tiendas = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (tiendas.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)"><i class="fas fa-store" style="font-size:40px;color:#ddd;display:block;margin-bottom:14px"></i><p>Aún no hay comercios disponibles.</p></div>`;
            return;
        }

        container.innerHTML = tiendas.map(t => `
        <div class="tienda-card" onclick="abrirTienda('${t.id}')">
            <div class="tienda-card-cover">${t.cover ? `<img src="${t.cover}">` : `<div style="background:linear-gradient(135deg,#e0e0e0,#f5f5f5);height:120px;display:flex;align-items:center;justify-content:center;font-size:40px">🏪</div>`}</div>
            <div class="tienda-card-body">
                <div class="tienda-card-logo">${t.logo ? `<img src="${t.logo}">` : '🏪'}</div>
                <div class="tienda-card-info">
                    <h4>${t.nombre}</h4>
                    <p>${t.tipo || 'Comercio'} ${t.direccion ? '· ' + t.direccion : ''}</p>
                    <div class="tienda-card-tags">
                        <span class="tienda-card-tag tienda-tag ${t.abierto !== false ? 'verde' : 'rojo'}">${t.abierto !== false ? '● Abierto' : '● Cerrado'}</span>
                        <span class="tienda-card-tag tienda-tag ${t.envio ? 'azul' : 'gris'}"><i class="fas fa-${t.envio ? 'motorcycle' : 'store'}"></i> ${t.envio ? 'Con envío' : 'Solo retiro'}</span>
                    </div>
                </div>
            </div>
        </div>`).join('');
    } catch (e) {
        console.error(e);
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
            db.collection('perfilesComercios').doc(tiendaId).get(),
            db.collection('perfilesComercios').doc(tiendaId).collection('ofertas').where('activo', '==', true).get()
        ]);

        if (!perfilDoc.exists) {
            panel.innerHTML = '<p>Comercio no encontrado.</p>';
            return;
        }

        const t = { id: tiendaId, ...perfilDoc.data() };
        Store.tiendaActual = t;
        const ofertas = ofertasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const categorias = ['Todos', ...new Set(ofertas.map(o => o.categoria).filter(Boolean))];

        panel.innerHTML = `
        <button onclick="cerrarTienda()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--primary);font-weight:700;font-size:14px;cursor:pointer;margin-bottom:14px;padding:0"><i class="fas fa-arrow-left"></i> Volver a comercios</button>
        <div class="tienda-header">
            <div class="tienda-cover">${t.cover ? `<img src="${t.cover}">` : ''}</div>
            <div class="tienda-info">
                <div class="tienda-logo-row">
                    <div class="tienda-logo">${t.logo ? `<img src="${t.logo}">` : '🏪'}</div>
                    <div class="tienda-nombre-bloque"><h3>${t.nombre}</h3><p>${t.tipo || ''} ${t.horario ? '· ' + t.horario : ''}</p></div>
                </div>
                <div class="tienda-meta">
                    <span class="tienda-tag ${t.abierto !== false ? 'verde' : 'rojo'}"><i class="fas fa-circle" style="font-size:8px"></i> ${t.abierto !== false ? 'Abierto' : 'Cerrado'}</span>
                    <span class="tienda-tag ${t.envio ? 'azul' : 'gris'}"><i class="fas fa-${t.envio ? 'motorcycle' : 'store'}"></i> ${t.envio ? (t.envioGratis && t.montoEnvioGratis > 0 ? `Envío gratis desde $${t.montoEnvioGratis}` : `Envío $${t.costoEnvio}`) : 'Solo retiro'}</span>
                    ${t.direccion ? `<span class="tienda-tag gris"><i class="fas fa-map-marker-alt"></i> ${t.direccion}</span>` : ''}
                    ${t.telefono ? `<span class="tienda-tag gris" style="cursor:pointer" onclick="window.open('https://wa.me/54${t.telefono.replace(/\D/g,'')}','_blank')"><i class="fab fa-whatsapp" style="color:#25d366"></i> ${t.telefono}</span>` : ''}
                </div>
                ${t.descripcion ? `<div class="tienda-desc">${t.descripcion}</div>` : ''}
            </div>
        </div>
        <div class="cat-filters" id="catFilters">${categorias.map((c,i) => `<button class="cat-filter-btn ${i===0?'active':''}" onclick="filtrarProductos('${c}',this)">${c}</button>`).join('')}</div>
        <div class="productos-grid" id="productosGrid">${renderProductosGrid(ofertas, null, t)}</div>`;

        panel.dataset.tiendaId = tiendaId;
        window._ofertasTienda = ofertas;
        window._tiendaActual = t;

    } catch (e) {
        console.error(e);
        panel.innerHTML = '<p style="padding:20px;color:var(--primary)">Error al cargar la tienda.</p>';
    }
}

function renderProductosGrid(ofertas, categoriaFiltro, tienda) {
    const filtradas = categoriaFiltro && categoriaFiltro !== 'Todos' ? ofertas.filter(o => o.categoria === categoriaFiltro) : ofertas;
    if (filtradas.length === 0) return `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light)"><p>No hay productos en esta categoría.</p></div>`;

    return filtradas.map(o => `
    <div class="producto-card" onclick='abrirProductoModal(${JSON.stringify(o).replace(/'/g,"&#39;")})'>
        <div class="producto-img">${o.imagen ? `<img src="${o.imagen}">` : '📦'}${o.precioOriginal ? `<span class="producto-oferta-badge">OFERTA</span>` : ''}</div>
        <div class="producto-body">
            <div class="producto-nombre">${o.nombre}</div>
            ${o.descripcion ? `<div class="producto-detalle">${o.descripcion.substring(0,50)}${o.descripcion.length>50?'...':''}</div>` : ''}
            <div class="producto-precio-row"><span class="producto-precio">$${parseFloat(o.precio).toLocaleString('es-AR')}</span>${o.precioOriginal ? `<span class="producto-precio-original">$${parseFloat(o.precioOriginal).toLocaleString('es-AR')}</span>` : ''}</div>
            <button class="producto-add-btn" onclick="event.stopPropagation();agregarAlCarrito(${JSON.stringify(o).replace(/'/g,"&#39;")})"><i class="fas fa-cart-plus"></i> Agregar</button>
        </div>
    </div>`).join('');
}

function filtrarProductos(categoria, btn) {
    document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const grid = document.getElementById('productosGrid');
    if (grid) grid.innerHTML = renderProductosGrid(window._ofertasTienda || [], categoria, window._tiendaActual);
}

function cerrarTienda() {
    document.getElementById('tiendaPanel').style.display = 'none';
    document.getElementById('tiendasListaView').style.display = 'block';
    Store.tiendaActual = null;
}

// ============================================
// CARRITO
// ============================================

let modalProductoQty = 1;

function abrirProductoModal(oferta) {
    modalProductoQty = 1;
    const overlay = document.getElementById('productoModalOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
    <div class="producto-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <span style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:1px">${oferta.categoria || ''}</span>
            <button onclick="cerrarProductoModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-light)">✕</button>
        </div>
        <div class="producto-modal-img">${oferta.imagen ? `<img src="${oferta.imagen}">` : '📦'}</div>
        <div class="producto-modal-nombre">${oferta.nombre}</div>
        ${oferta.descripcion ? `<div class="producto-modal-desc">${oferta.descripcion}</div>` : ''}
        <div class="producto-modal-precio-row">
            <span class="producto-modal-precio">$${parseFloat(oferta.precio).toLocaleString('es-AR')}</span>
            ${oferta.precioOriginal ? `<span class="producto-modal-original">$${parseFloat(oferta.precioOriginal).toLocaleString('es-AR')}</span>` : ''}
            ${oferta.precioOriginal ? `<span style="background:rgba(224,0,0,0.1);color:var(--primary);font-size:12px;font-weight:700;padding:3px 8px;border-radius:8px">-${Math.round((1 - oferta.precio/oferta.precioOriginal)*100)}% OFF</span>` : ''}
        </div>
        <div class="producto-modal-qty-row">
            <span>Cantidad</span>
            <div class="modal-qty-ctrl">
                <button class="modal-qty-btn" onclick="changeModalQty(-1,${oferta.precio})">−</button>
                <span class="modal-qty-val" id="modalQtyVal">1</span>
                <button class="modal-qty-btn" onclick="changeModalQty(1,${oferta.precio})">+</button>
            </div>
        </div>
        <button class="producto-modal-add-btn" onclick="agregarAlCarritoModal(${JSON.stringify(oferta).replace(/'/g,"&#39;")})">
            <i class="fas fa-cart-plus"></i> Agregar · $<span id="modalPrecioTotal">${parseFloat(oferta.precio).toLocaleString('es-AR')}</span>
        </button>
    </div>`;
    overlay.classList.add('open');
}

function changeModalQty(delta, precio) {
    modalProductoQty = Math.max(1, modalProductoQty + delta);
    document.getElementById('modalQtyVal').textContent = modalProductoQty;
    document.getElementById('modalPrecioTotal').textContent = (precio * modalProductoQty).toLocaleString('es-AR');
}

function cerrarProductoModal() {
    document.getElementById('productoModalOverlay').classList.remove('open');
}

function agregarAlCarritoModal(o) {
    for (let i = 0; i < modalProductoQty; i++) agregarAlCarrito(o);
    cerrarProductoModal();
}

function agregarAlCarrito(oferta) {
    const tiendaId = Store.tiendaActual?.id;
    const tiendaNombre = Store.tiendaActual?.nombre || 'Comercio';

    if (Store.carrito.length > 0 && Store.carritoTiendaId !== tiendaId) {
        if (!confirm(`Tu carrito tiene productos de "${Store.carritoTiendaNombre}". ¿Vaciarlo y empezar con ${tiendaNombre}?`)) return;
        Store.carrito = [];
    }

    Store.carritoTiendaId = tiendaId;
    Store.carritoTiendaNombre = tiendaNombre;

    const existing = Store.carrito.find(i => i.id === oferta.id);
    if (existing) existing.qty++;
    else Store.carrito.push({ ...oferta, qty: 1 });

    updateCarritoUI();
    if (typeof showToast === 'function') showToast(`${oferta.nombre} agregado al carrito 🛒`, 'success', 2000);
}

function updateCarritoUI() {
    const count = Store.carrito.reduce((s, i) => s + i.qty, 0);
    const fab = document.getElementById('carritoFab');
    if (fab) fab.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('carritoCount').textContent = count;
}

function abrirCarrito() {
    const panel = document.getElementById('carritoPanel');
    const overlay = document.getElementById('carritoOverlay');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
    renderCarritoPanel();
}

function cerrarCarrito() {
    document.getElementById('carritoPanel').classList.remove('open');
    document.getElementById('carritoOverlay').classList.remove('open');
}

function renderCarritoPanel() {
    const panel = document.getElementById('carritoPanel');
    const tienda = Store.tiendaActual || { nombre: Store.carritoTiendaNombre, envio: false, costoEnvio: 0, montoEnvioGratis: 0 };
    const subtotal = Store.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
    const costoEnvio = tienda.envio ? (tienda.envioGratis && subtotal >= tienda.montoEnvioGratis ? 0 : tienda.costoEnvio) : 0;
    const total = subtotal + costoEnvio;

    panel.innerHTML = `
    <div class="carrito-panel-header">
        <h3><i class="fas fa-shopping-cart" style="color:var(--primary)"></i> Tu carrito</h3>
        <button onclick="cerrarCarrito()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-light)">✕</button>
    </div>
    ${Store.carrito.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-light)"><i class="fas fa-shopping-cart" style="font-size:32px;color:#ddd;display:block;margin-bottom:10px"></i><p>Tu carrito está vacío</p></div>` :
    Store.carrito.map(item => `
    <div class="carrito-item">
        <div class="carrito-item-emoji">${item.imagen ? `<img src="${item.imagen}" style="width:42px;height:42px;object-fit:cover;border-radius:8px">` : '📦'}</div>
        <div class="carrito-item-info"><h4>${item.nombre}</h4><p>$${parseFloat(item.precio).toLocaleString('es-AR')} c/u</p></div>
        <div class="carrito-qty-ctrl">
            <button class="carrito-qty-btn" onclick="cambiarQtyCarrito('${item.id}', -1)">−</button>
            <span class="carrito-qty">${item.qty}</span>
            <button class="carrito-qty-btn" onclick="cambiarQtyCarrito('${item.id}', 1)">+</button>
        </div>
        <span class="carrito-item-total">$${(item.precio * item.qty).toLocaleString('es-AR')}</span>
    </div>`).join('')}
    ${Store.carrito.length > 0 ? `
    <div class="carrito-total-row"><span class="label">Subtotal</span><span class="value">$${subtotal.toLocaleString('es-AR')}</span></div>
    <div class="carrito-envio-row"><span><i class="fas fa-motorcycle"></i> Envío</span><span>${costoEnvio === 0 ? '¡Gratis!' : `$${costoEnvio.toLocaleString('es-AR')}`}</span></div>
    <div class="carrito-total-row" style="border-top:2px solid rgba(224,0,0,0.15)"><span class="label">TOTAL</span><span class="value">$${total.toLocaleString('es-AR')}</span></div>
    <button class="carrito-checkout-btn" onclick="enviarPedidoFiado()"><i class="fas fa-paper-plane"></i> Enviar pedido por fiado</button>
    <button onclick="vaciarCarrito()" style="width:100%;background:none;border:none;color:var(--text-light);font-size:13px;cursor:pointer;margin-top:8px;text-align:center">🗑️ Vaciar carrito</button>` : ''}`;
}

function cambiarQtyCarrito(id, delta) {
    const item = Store.carrito.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) Store.carrito = Store.carrito.filter(i => i.id !== id);
    updateCarritoUI();
    renderCarritoPanel();
}

function vaciarCarrito() {
    if (!confirm('¿Vaciar el carrito?')) return;
    Store.carrito = [];
    Store.carritoTiendaId = null;
    updateCarritoUI();
    cerrarCarrito();
}

async function enviarPedidoFiado() {
    if (Store.carrito.length === 0) return;
    const user = firebase.auth().currentUser;
    if (!user) { 
        if (typeof showToast === 'function') showToast('Iniciá sesión para enviar el pedido.', 'warning'); 
        return; 
    }

    const tienda = Store.tiendaActual || {};
    const subtotal = Store.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
    const costoEnvio = tienda.envio ? (tienda.envioGratis && subtotal >= tienda.montoEnvioGratis ? 0 : (tienda.costoEnvio || 0)) : 0;
    const total = subtotal + costoEnvio;

    try {
        const items = Store.carrito.map(i => ({ name: i.nombre, price: i.precio, quantity: i.qty, total: i.precio * i.qty, categoria: i.categoria || '' }));
        await db.collection('purchases').add({
            clienteId: user.uid,
            clienteEmail: user.email,
            comercianteId: Store.carritoTiendaId,
            comercianteNombre: Store.carritoTiendaNombre,
            category: 'tienda-online',
            items,
            subtotal,
            costoEnvio,
            total,
            envioSolicitado: tienda.envio && costoEnvio >= 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
            paid: false,
            origen: 'tienda'
        });
        if (typeof showToast === 'function') showToast('¡Pedido enviado! El comerciante lo aprobará en breve. 🎉', 'success', 5000);
        Store.carrito = [];
        Store.carritoTiendaId = null;
        updateCarritoUI();
        cerrarCarrito();
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error al enviar el pedido.', 'warning');
    }
}

// ============================================
// SUSCRIPCIÓN
// ============================================

async function loadSuscripcionPanel(comercianteId) {
    const panel = document.getElementById('suscripcionPanel');
    const historial = document.getElementById('historialCargos');
    if (!panel) return;

    try {
        const ahora = new Date();
        const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();

        const ventasSnap = await db.collection('purchases')
            .where('comercianteId', '==', comercianteId)
            .where('status', '==', 'approved')
            .get();

        let ventasMes = 0;
        ventasSnap.forEach(doc => {
            const d = doc.data();
            if (d.createdAt >= primerDiaMes) ventasMes += d.total || 0;
        });

        const cargo5pct = ventasMes * 0.05;
        const mes = ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        panel.innerHTML = `
<div class="suscripcion-panel">
    <div class="suscripcion-title">Suscripción mensual · ${mes}</div>
    <div class="suscripcion-amount"><sup>$</sup>${cargo5pct.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</div>
    <div class="suscripcion-subtitle">5% sobre ventas del mes</div>
    <div class="suscripcion-breakdown">
        <div class="suscripcion-row"><span class="label">Ventas aprobadas del mes</span><span class="value">$${ventasMes.toLocaleString('es-AR', {minimumFractionDigits:2})}</span></div>
        <div class="suscripcion-row total"><span class="label">Total a pagar (5%)</span><span class="value">$${cargo5pct.toLocaleString('es-AR', {minimumFractionDigits:2})}</span></div>
    </div>
    ${cargo5pct > 0 ? `
        <button class="suscripcion-pay-btn" onclick="pagarSuscripcion(${cargo5pct.toFixed(2)})" style="width:100%;margin-bottom:8px">
            <i class="fas fa-hand-holding-usd"></i> Ya transferí / pagué en efectivo
        </button>
        <button class="suscripcion-pay-btn" onclick="pagarSuscripcionMP(${cargo5pct.toFixed(2)})" style="width:100%;background:#00a650">
            <i class="fas fa-mobile-alt"></i> Pagar con Mercado Pago
        </button>
    ` : '<div style="color:var(--success);font-weight:700">✅ Sin cargos pendientes</div>'}
</div>`;

        if (historial) {
            historial.innerHTML = `<div class="no-items">Aún no hay cargos registrados</div>`;
        }

    } catch (e) {
        console.error(e);
        panel.innerHTML = `<div class="no-items">Error al calcular</div>`;
    }
}

async function pagarSuscripcion(monto) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (!confirm(`¿Confirmás el pago del cargo de mantenimiento por $${monto.toFixed(2)}?`)) return;

    try {
        await db.collection('cargosMantenimiento').add({
            comercianteId: user.uid,
            monto: monto,
            fecha: new Date().toISOString(),
            pagado: false,
            mes: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        });
        if (typeof showToast === 'function') showToast(`Cargo de $${monto.toFixed(2)} registrado.`, 'success');
        loadSuscripcionPanel(user.uid);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Error al registrar el pago.', 'warning');
    }
}

// ============================================
// INIT
// ============================================

function initStoreComerciante(uid) {
    if (!uid) return;
    console.log('🔧 Inicializando store comerciante:', uid);
    loadPerfilComerciante(uid);
    loadOfertasComerciante(uid);
    showOfertaForm();
}

function initStoreCliente() {
    console.log('🔧 Inicializando store cliente');
    loadTiendasParaCliente();
}

// Funciones globales
window.initStoreComerciante = initStoreComerciante;
window.initStoreCliente = initStoreCliente;
window.guardarPerfilComerciante = guardarPerfilComerciante;
window.loadTiendasParaCliente = loadTiendasParaCliente;
window.showOfertaForm = showOfertaForm;
window.editarOferta = editarOferta;
window.cancelarEdicionOferta = cancelarEdicionOferta;
window.toggleOfertaActiva = toggleOfertaActiva;
window.eliminarOferta = eliminarOferta;
window.abrirTienda = abrirTienda;
window.cerrarTienda = cerrarTienda;
window.filtrarProductos = filtrarProductos;
window.abrirProductoModal = abrirProductoModal;
window.cerrarProductoModal = cerrarProductoModal;
window.changeModalQty = changeModalQty;
window.agregarAlCarritoModal = agregarAlCarritoModal;
window.agregarAlCarrito = agregarAlCarrito;
window.abrirCarrito = abrirCarrito;
window.cerrarCarrito = cerrarCarrito;
window.cambiarQtyCarrito = cambiarQtyCarrito;
window.vaciarCarrito = vaciarCarrito;
window.enviarPedidoFiado = enviarPedidoFiado;
window.pagarSuscripcion = pagarSuscripcion;
window.loadSuscripcionPanel = loadSuscripcionPanel;
window.toggleEnvioOptions = toggleEnvioOptions;
window.previewLogo = previewLogo;
window.previewCover = previewCover;
window.guardarOferta = guardarOferta;
window.previewOfertaImg = previewOfertaImg;

console.log('✅ store.js cargado correctamente');