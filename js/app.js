// ============================================
// CLUBALMACÉN V5 – app.js
// Compras · Pagos · Scoring · Fiados · Comerciante
// ============================================

const AppState = {
    purchase: { category: '', comercianteId: '', items: [], total: 0 },
    payment:  { selectedMethod: null, purchaseId: null },
    scoring:  { score: 0, category: 'low' },
};

// ============================================
// SCORING (TIEMPO REAL)
// ============================================

async function loadUserScoring(userId) {
    try {
        console.log("Cargando scoring del usuario:", userId);
        db.collection("users").doc(userId).collection("scoring").doc("data")
            .onSnapshot((scoringDoc) => {
                if (scoringDoc.exists) {
                    const data = scoringDoc.data();
                    AppState.scoring = data;
                    _renderScoring(data);

                    if (data._lastUpdate && data._lastPoints) {
                        showToast(`🎉 ¡Sumaste ${data._lastPoints} puntos! Total: ${data.score}`, 'success', 5000);
                    }

                    const electroBtn = document.getElementById('electroBtn');
                    if (electroBtn) {
                        if (data.category === "high" && data.score >= 700) {
                            electroBtn.disabled = false;
                            electroBtn.innerHTML = '<i class="fas fa-tv"></i> Electrodomésticos';
                        } else {
                            electroBtn.disabled = true;
                            electroBtn.innerHTML = '<i class="fas fa-lock"></i> Electrodomésticos (Score Alto)';
                        }
                    }
                    console.log("Scoring actualizado en tiempo real:", data);
                } else {
                    _initScoring(userId);
                }
            }, (error) => {
                console.error("Error al escuchar scoring:", error);
            });
    } catch (error) {
        console.error("Error al cargar scoring:", error);
    }
}

// ============================================
// VENCIMIENTOS Y PRÓRROGAS
// ============================================

async function setearVencimiento(purchaseId, fechaVencimiento) {
    if (!fechaVencimiento) return;
    const comerciante = requireAuth();
    try {
        await db.collection(COL.PURCHASES).doc(purchaseId).update({
            fechaVencimiento: fechaVencimiento,
            vencimientoSetBy: comerciante.uid,
            updatedAt: now()
        });
        showToast('✅ Fecha de vencimiento establecida','success');
        loadPurchasesToApprove(comerciante.uid);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function prorrogarVencimiento(purchaseId, nuevaFecha) {
    if (!nuevaFecha) return;
    const comerciante = requireAuth();
    try {
        await db.collection(COL.PURCHASES).doc(purchaseId).update({
            fechaVencimiento: nuevaFecha,
            prorrogaCount: firebase.firestore.FieldValue.increment(1),
            prorrogaAt: now(),
            updatedAt: now()
        });
        showToast('✅ Vencimiento prorrogado','success');
        loadPurchasesToApprove(comerciante.uid);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

async function noPuedoPagar(purchaseId, motivo) {
    if (!motivo) { showToast('Por favor, indicá el motivo','warning'); return; }
    const cliente = requireAuth();
    try {
        await db.collection(COL.PURCHASES).doc(purchaseId).update({
            estadoPago: 'no_puedo_pagar',
            motivoNoPago: motivo,
            noPagoAt: now(),
            updatedAt: now()
        });
        showToast('📋 Tu situación fue registrada. El comerciante te contactará.','info',6000);
        const purchase = await db.collection(COL.PURCHASES).doc(purchaseId).get();
        if (purchase.exists && typeof crearNotificacion === 'function') {
            crearNotificacion(purchase.data().comercianteId,
                `🔔 ${cliente.email} marcó "No puedo pagar" en la compra ${purchaseId}. Motivo: ${motivo}`,
                'warning', 'fa-exclamation-triangle', 'orange');
        }
        loadClientPurchases(cliente.uid);
    } catch(e) { showToast(`Error: ${e.message}`,'error'); }
}

// ============================================
// RENDER DE LISTA DE COMPRAS
// ============================================
// CORRECCIÓN: esta función estaba definida DOS VECES en el archivo original.
// La segunda definición (más simple, sin vencimiento ni botón "No puedo pagar")
// pisaba a esta —la completa— porque en JS la última función declarada con el
// mismo nombre gana. Eso hacía desaparecer silenciosamente el botón "No puedo
// pagar" y la fecha de vencimiento en la lista de compras del cliente.
// Se deja UNA sola versión (la completa) y se elimina el duplicado de más abajo.

function _renderPurchaseList(containerId, items, showPayBtn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (items.length === 0) { el.innerHTML = '<div class="no-items">Sin compras</div>'; return; }
    el.innerHTML = items.map(p => `
        <div class="purchase-item">
            <div class="purchase-info">
                <h4>${p.category || 'Compra'}</h4>
                <p>${p.items?.length||0} producto(s) · ${new Date(p.createdAt).toLocaleDateString('es-AR')}</p>
                <span class="status-badge ${p.status}">${p.status==='pending'?'Pendiente':'Aprobada'}</span>
                ${p.fechaVencimiento ? `<p style="font-size:12px;color:${new Date(p.fechaVencimiento) < new Date() ? 'var(--primary)' : 'var(--text-light)'}">
                    ⏳ Vence: ${new Date(p.fechaVencimiento).toLocaleDateString('es-AR')}
                    ${new Date(p.fechaVencimiento) < new Date() ? ' (VENCIDO)' : ''}
                </p>` : ''}
                ${p.estadoPago === 'no_puedo_pagar' ? `<span class="status-badge" style="background:rgba(255,0,0,0.1);color:var(--primary)">🆘 No puedo pagar</span>` : ''}
            </div>
            <div style="text-align:right">
                <div class="purchase-total">$${(p.total||0).toFixed(2)}</div>
                ${showPayBtn && !p.paid && p.estadoPago !== 'no_puedo_pagar'
                    ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 12px;margin-top:6px"
                        onclick="pagarCompraDirecta('${p.id}',${p.total},'${p.comercianteId}')">
                        <i class="fas fa-credit-card"></i> Pagar
                      </button>
                      <button class="btn btn-outline" style="font-size:10px;padding:4px 8px;margin-top:4px;color:var(--primary)"
                        onclick="const m=prompt('Motivo:'); if(m) noPuedoPagar('${p.id}', m)">
                        <i class="fas fa-exclamation-circle"></i> No puedo pagar
                      </button>`
                    : ''}
                ${showPayBtn && p.estadoPago === 'no_puedo_pagar'
                    ? `<span style="font-size:11px;color:var(--text-light);display:block;margin-top:4px">⏳ Asistencia en curso</span>`
                    : ''}
                ${p.paid ? '<span style="font-size:12px;color:var(--success)">✅ Pagada</span>' : ''}
            </div>
        </div>`).join('');
}

// ============================================
// COMPRAS – CLIENTE
// ============================================

function startPurchase() {
    const flow = document.getElementById('purchaseFlow');
    const btn  = document.getElementById('startPurchaseBtn');
    if (flow) { flow.classList.remove('hidden'); flow.style.display = 'block'; }
    if (btn)  btn.style.display = 'none';
    AppState.purchase = { category: '', comercianteId: '', items: [], total: 0 };
}

function selectCategory(category) {
    if (category === 'electrodomesticos' && AppState.scoring.score < 700) {
        showToast('Necesitás scoring 700+ para electrodomésticos', 'warning'); return;
    }
    AppState.purchase.category = category;
    document.querySelectorAll('.category-buttons button').forEach(b => {
        const sel = b.dataset.category === category;
        b.classList.toggle('active', sel);
        b.classList.toggle('btn-outline', !sel);
    });
    const ms = document.getElementById('merchantSection');
    if (ms) { ms.classList.remove('hidden'); ms.style.display = 'block'; }
    loadComerciantes();
}

async function loadComerciantes() {
    try {
        const snap = await db.collection(COL.USERS).where('role','==','comerciante').get();
        const select = document.getElementById('comercianteSelect');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar Comercio</option>';

        const perfiles = await Promise.all(snap.docs.map(d =>
            db.collection(COL.PERFILES_COMERCIOS).doc(d.id).get()
        ));

        snap.docs.forEach((doc, i) => {
            const perfil = perfiles[i].exists ? perfiles[i].data() : null;
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = perfil?.nombre || doc.data().email;
            select.appendChild(opt);
        });

        select.onchange = e => {
            if (!e.target.value) return;
            AppState.purchase.comercianteId = e.target.value;
            const is = document.getElementById('itemsSection');
            if (is) { is.classList.remove('hidden'); is.style.display = 'block'; }
        };
    } catch (e) {
        // Si esto falla con "Missing or insufficient permissions" es el problema
        // de reglas de Firestore (ver firestore.rules) — el cliente se queda sin
        // poder elegir comercio y por lo tanto sin poder comprar.
        console.error('loadComerciantes:', e); showToast('Error al cargar comercios','error');
    }
}

function addItemToList() {
    const name = document.getElementById('itemName')?.value?.trim();
    const price = parseFloat(document.getElementById('itemPrice')?.value);
    const qty   = parseInt(document.getElementById('itemQuantity')?.value) || 1;
    if (!name || isNaN(price) || price <= 0) { showToast('Completá nombre y precio','warning'); return; }
    AppState.purchase.items.push({ name, price, quantity: qty, total: price * qty });
    AppState.purchase.total += price * qty;
    _renderItemsList();
    document.getElementById('itemName').value  = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemQuantity').value = '1';
}

function removeItem(index) {
    AppState.purchase.total -= AppState.purchase.items[index].total;
    AppState.purchase.items.splice(index, 1);
    _renderItemsList();
}

function _renderItemsList() {
    const list    = document.getElementById('itemsList');
    const totalEl = document.getElementById('purchaseTotal');
    if (!list || !totalEl) return;
    list.innerHTML = AppState.purchase.items.map((it, i) => `
        <div class="purchase-item">
            <div class="purchase-info"><h4>${it.name}</h4><p>${it.quantity} × $${it.price.toFixed(2)}</p></div>
            <div style="display:flex;align-items:center;gap:10px">
                <span class="purchase-total">$${it.total.toFixed(2)}</span>
                <button class="btn btn-outline" onclick="removeItem(${i})" style="padding:6px 10px">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`).join('');
    totalEl.textContent = AppState.purchase.total.toFixed(2);
}

async function submitPurchase() {
    const { items, comercianteId, category, total } = AppState.purchase;
    if (items.length === 0)  { showToast('Agregá al menos un producto','warning'); return; }
    if (!comercianteId)      { showToast('Seleccioná un comerciante','warning');   return; }
    const user = requireAuth();
    setButtonLoading('submitPurchaseBtn', true);
    try {
        await db.collection(COL.PURCHASES).add({
            clienteId: user.uid, clienteEmail: user.email,
            comercianteId, category, items, total,
            status: 'pending', paid: false, origen: 'manual', createdAt: now()
        });
        showToast('Compra enviada. Esperá la aprobación del comercio.','success');
        AppState.purchase = { category:'', comercianteId:'', items:[], total:0 };
        const pf = document.getElementById('purchaseFlow');
        const sb = document.getElementById('startPurchaseBtn');
        if (pf) { pf.classList.add('hidden'); pf.style.display = 'none'; }
        if (sb) sb.style.display = 'block';
        _renderItemsList();
        loadClientPurchases(user.uid);
    } catch (e) {
        // "Missing or insufficient permissions" acá = las reglas no dejan
        // crear en /purchases; ver firestore.rules.
        showToast(`Error: ${e.message}`,'error');
    }
    finally { setButtonLoading('submitPurchaseBtn', false); }
}

async function loadClientPurchases(clienteId) {
    try {
        const snap = await db.collection(COL.PURCHASES)
            .where('clienteId','==', clienteId).get();

        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

        _renderPurchaseList('pendingPurchasesList',  all.filter(p => p.status === 'pending'),  false);
        _renderPurchaseList('approvedPurchasesList', all.filter(p => p.status === 'approved'), true);
    } catch (e) { console.error('loadClientPurchases:', e); }
}

// ============================================
// FIADOS – CLIENTE
// ============================================

async function loadMyFiados(clienteId) {
    const el = document.getElementById('misFiados');
    if (!el) return;
    try {
        const usersSnap = await db.collection(COL.USERS).where('role','==','comerciante').get();
        const checks = await Promise.all(usersSnap.docs.map(d =>
            db.collection(COL.USERS).doc(d.id).collection(COL.FIADOS).doc(clienteId).get()
                .then(f => f.exists ? { comercianteId:d.id, email:d.data().email, ...f.data() } : null)
        ));
        const fiados = checks.filter(Boolean);

        if (fiados.length === 0) {
            el.innerHTML = '<div class="no-items">No tenés créditos habilitados aún</div>'; return;
        }

        let totalLimit = 0, totalUsed = 0;
        fiados.forEach(f => { totalLimit += f.monto_fiado||0; totalUsed += f.usado||0; });
        _setEl('totalCredit',    `$${totalLimit.toFixed(2)}`);
        _setEl('creditUsed',     `$${totalUsed.toFixed(2)}`);
        _setEl('creditAvailable',`$${(totalLimit-totalUsed).toFixed(2)}`);

        el.innerHTML = fiados.map(f => {
            const disp = (f.monto_fiado||0) - (f.usado||0);
            const pct  = f.monto_fiado > 0 ? (f.usado/f.monto_fiado*100) : 0;
            return `
            <div class="purchase-item">
                <div style="flex:1">
                    <strong>${f.email||'Comercio'}</strong>
                    <div style="height:6px;background:#f0f0f0;border-radius:4px;overflow:hidden;margin:8px 0">
                        <div style="height:100%;width:${Math.min(pct,100)}%;background:var(--gradient-primary);border-radius:4px"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:13px">
                        <span>Usado: <strong>$${(f.usado||0).toFixed(2)}</strong></span>
                        <span>Disponible: <strong style="color:var(--success)">$${disp.toFixed(2)}</strong></span>
                    </div>
                </div>
                <div style="text-align:right;margin-left:12px">
                    <div style="font-size:18px;font-weight:700;color:var(--primary)">$${(f.monto_fiado||0).toFixed(2)}</div>
                    <div style="font-size:11px;color:var(--text-light)">límite</div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadMyFiados:', e); el.innerHTML = '<div class="no-items">Error al cargar créditos</div>'; }
}

// ============================================
// MODAL DE PAGO
// ============================================

async function openPaymentModal() {
    const user = requireAuth();
    try {
        const snap = await db.collection(COL.PURCHASES)
            .where('clienteId','==', user.uid)
            .where('status','==','approved')
            .get();

        const sinPagar = snap.docs.filter(d => !d.data().paid);

        if (sinPagar.length === 0) {
            showToast('No tenés compras aprobadas pendientes de pago','info'); return;
        }

        const select = document.getElementById('purchaseToPaySelect');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar compra</option>';
        sinPagar.forEach(doc => {
            const d   = doc.data();
            const fecha = d.approvedAt ? new Date(d.approvedAt).toLocaleDateString('es-AR') : '';
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = `$${(d.total||0).toFixed(2)} – ${d.category||'Compra'} ${fecha}`;
            opt.dataset.total         = d.total || 0;
            opt.dataset.comercianteId = d.comercianteId || '';
            select.appendChild(opt);
        });

        AppState.payment = { selectedMethod: null, purchaseId: null };
        const cpb = document.getElementById('confirmPaymentBtn');
        if (cpb) cpb.disabled = true;
        document.getElementById('paymentDetailsSection')?.classList.add('hidden');
        document.getElementById('purchaseDetails')?.classList.add('hidden');
        document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));

        const modal = document.getElementById('paymentModal');
        if (modal) modal.style.display = 'flex';
    } catch (e) { console.error('openPaymentModal:', e); showToast(`Error: ${e.message}`,'error'); }
}

async function pagarCompraDirecta(purchaseId, total, comercianteId) {
    await openPaymentModal();
    setTimeout(() => {
        const select = document.getElementById('purchaseToPaySelect');
        if (!select) return;
        const opt = [...select.options].find(o => o.value === purchaseId);
        if (opt) { select.value = purchaseId; select.dispatchEvent(new Event('change')); }
    }, 150);
}

function loadPurchaseDetails(event) {
    const select = event.target;
    if (!select.value) {
        document.getElementById('purchaseDetails')?.classList.add('hidden');
        AppState.payment.purchaseId = null;
        return;
    }
    const opt   = select.options[select.selectedIndex];
    const total = parseFloat(opt.dataset.total || 0);
    AppState.payment.purchaseId = select.value;
    _setEl('amountToPay', total.toFixed(2));
    const ai = document.getElementById('paymentAmount');
    if (ai) ai.value = total.toFixed(2);
    const cid = opt.dataset.comercianteId;

    if (cid) {
        db.collection(COL.USERS).doc(cid).get()
            .then(d => {
                const email = d.exists ? (d.data().email||'Comercio') : 'Comercio';
                _setEl('merchantToPay', email);
                const wallet = d.exists ? (d.data().wallet||{}) : {};
                window._comercianteAlias = wallet.alias || null;
                const mpBtn = document.querySelector('#transferenciaDetails .btn-primary');
                if (mpBtn && window._comercianteAlias) {
                    mpBtn.style.display = 'block';
                } else if (mpBtn) {
                    mpBtn.style.display = 'none';
                }
            });
    }
    document.getElementById('purchaseDetails')?.classList.remove('hidden');
    _checkEnableConfirm();
}

function selectPaymentMethod(method) {
    AppState.payment.selectedMethod = method;
    document.querySelectorAll('.payment-option').forEach(o =>
        o.classList.toggle('active', o.dataset.method === method));
    document.getElementById('paymentDetailsSection')?.classList.remove('hidden');
    document.getElementById('efectivoDetails')?.classList.toggle('hidden',      method !== 'efectivo');
    document.getElementById('transferenciaDetails')?.classList.toggle('hidden', method !== 'transferencia');
    const lbl = document.getElementById('paymentMethodLabel');
    if (lbl) lbl.textContent = method === 'efectivo' ? 'Instrucciones' : 'Datos de la transferencia';
    _checkEnableConfirm();
}

function _checkEnableConfirm() {
    const btn = document.getElementById('confirmPaymentBtn');
    if (btn) btn.disabled = !(AppState.payment.purchaseId && AppState.payment.selectedMethod);
}

async function confirmPayment() {
    const { purchaseId, selectedMethod } = AppState.payment;
    if (!purchaseId || !selectedMethod) return;
    const user = requireAuth();
    setButtonLoading('confirmPaymentBtn', true);
    try {
        const select = document.getElementById('purchaseToPaySelect');
        const opt    = select?.options[select.selectedIndex];
        const amount = parseFloat(opt?.dataset.total || 0);
        const cid    = opt?.dataset.comercianteId || '';
        if (amount <= 0) throw new Error('Monto inválido');

        const payData = {
            purchaseId, userId: user.uid, userEmail: user.email,
            comercianteId: cid, amount, method: selectedMethod,
            approved: false, rejected: false, date: now()
        };

        if (selectedMethod === 'transferencia') {
            const comp = document.getElementById('comprobanteNumber')?.value?.trim();
            const mnt  = parseFloat(document.getElementById('paymentAmount')?.value);
            if (!comp) throw new Error('Ingresá el número de comprobante');
            if (!mnt || mnt <= 0) throw new Error('Ingresá un monto válido');
            payData.comprobante = comp;
            payData.amount      = mnt;
        }

        await db.collection(COL.PAYMENTS).add(payData);
        closePaymentModal();
        _showPaymentSuccess(amount);
        loadClientPurchases(user.uid);
        loadPaymentHistory(user.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
    finally { setButtonLoading('confirmPaymentBtn', false); }
}

function closePaymentModal() {
    const m = document.getElementById('paymentModal');
    if (m) m.style.display = 'none';
    AppState.payment = { selectedMethod: null, purchaseId: null };
}

function _showPaymentSuccess(amount) {
    const n = document.getElementById('paymentNotification');
    _setEl('notificationMessage', `Pago de $${amount.toFixed(2)} registrado`);
    _setEl('pointsEarned', Math.floor(amount/100)*10 + 10);
    if (n) n.style.display = 'flex';
}

function closeNotification() {
    const n = document.getElementById('paymentNotification');
    if (n) n.style.display = 'none';
}

// ============================================
// HISTORIAL DE PAGOS
// ============================================

async function loadPaymentHistory(userId) {
    const el = document.getElementById('paymentHistoryList');
    if (!el) return;
    try {
        const snap = await db.collection(COL.PAYMENTS).where('userId','==',userId).get();
        const docs = snap.docs.sort((a,b) => (b.data().date||'').localeCompare(a.data().date||'')).slice(0,30);

        if (docs.length === 0) { el.innerHTML = '<div class="no-items">Sin historial de pagos</div>'; return; }
        el.innerHTML = docs.map(doc => {
            const p = doc.data();
            const estado = p.approved ? '✅ Aprobado' : p.rejected ? '❌ Rechazado' : '⏳ Pendiente';
            return `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${p.method==='efectivo'?'Efectivo':'Transferencia'}</h4>
                    <p>${new Date(p.date).toLocaleDateString('es-AR')} · ${estado}</p>
                    ${p.comprobante?`<p style="font-size:12px;color:var(--text-light)">Comp: ${p.comprobante}</p>`:''}
                </div>
                <span class="purchase-total">$${(p.amount||0).toFixed(2)}</span>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadPaymentHistory:', e); }
}

// ============================================
// COMERCIANTE – COMPRAS
// ============================================

async function loadPurchasesToApprove(comercianteId) {
    const el    = document.getElementById('purchasesToApprove');
    const badge = document.getElementById('pendingBadge');
    if (!el) return;
    try {
        const snap = await db.collection(COL.PURCHASES)
            .where('comercianteId','==', comercianteId)
            .where('status','==','pending').get();

        const docs = snap.docs.sort((a,b) =>
            (b.data().createdAt||'').localeCompare(a.data().createdAt||''));

        if (badge) badge.textContent = docs.length;
        if (docs.length === 0) { el.innerHTML = '<div class="no-items">Sin pedidos pendientes</div>'; return; }

        el.innerHTML = docs.map(doc => {
            const p    = doc.data();
            const items= (p.items||[]).map(i=>`${i.name} ×${i.quantity}`).join(', ');
            return `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${p.clienteEmail||'Cliente'}</h4>
                    <p style="font-size:12px">${items}</p>
                    <p style="font-size:12px;color:var(--text-light)">${new Date(p.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
                <div style="text-align:right">
                    <div class="purchase-total">$${(p.total||0).toFixed(2)}</div>
                    <div style="display:flex;gap:6px;margin-top:8px">
                        <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                            onclick="approvePurchase('${doc.id}','${p.clienteId}',${p.total||0})">
                            <i class="fas fa-check"></i> Aprobar
                        </button>
                        <button class="btn btn-outline" style="font-size:12px;padding:6px 10px"
                            onclick="rejectPurchase('${doc.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadPurchasesToApprove:', e); el.innerHTML = '<div class="no-items">Error al cargar pedidos</div>'; }
}

async function approvePurchase(purchaseId, clienteId, total) {
    const com = requireAuth();
    try {
        const fiadoRef = db.collection(COL.USERS).doc(com.uid).collection(COL.FIADOS).doc(clienteId);
        const fiadoDoc = await fiadoRef.get();

        if (fiadoDoc.exists) {
            const f = fiadoDoc.data();
            const nuevoUsado = (f.usado||0) + total;
            if (nuevoUsado > (f.monto_fiado||0)) {
                if (!confirm(`El cliente supera su límite ($${f.monto_fiado}). ¿Aprobás igual?`)) return;
            }
            await fiadoRef.update({ usado: nuevoUsado, updatedAt: now() });
        }

        await db.collection(COL.PURCHASES).doc(purchaseId).update({
            status:'approved', approvedAt: now(), approvedBy: com.uid, paid:false, updatedAt: now()
        });

        showToast('Compra aprobada ✅','success');
        if (typeof crearNotificacion === 'function')
            crearNotificacion(clienteId,'🛍️ Tu compra fue aprobada. ¡Ya podés pagar!','success','fa-check','green');
        loadPurchasesToApprove(com.uid);
        updateMerchantStats(com.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
}

async function rejectPurchase(purchaseId) {
    if (!confirm('¿Rechazar esta compra?')) return;
    const com = requireAuth();
    try {
        await db.collection(COL.PURCHASES).doc(purchaseId).update({
            status:'rejected', rejectedAt: now(), rejectedBy: com.uid
        });
        showToast('Compra rechazada','info');
        loadPurchasesToApprove(com.uid);
        updateMerchantStats(com.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
}

async function loadApprovedPurchasesMerchant(comercianteId) {
    const el = document.getElementById('approvedPurchasesMerchantList');
    if (!el) return;
    try {
        const snap = await db.collection(COL.PURCHASES)
            .where('comercianteId','==', comercianteId)
            .where('status','==','approved').get();

        const docs = snap.docs
            .sort((a,b) => (b.data().approvedAt||b.data().createdAt||'')
                          .localeCompare(a.data().approvedAt||a.data().createdAt||''))
            .slice(0,50);

        if (docs.length === 0) { el.innerHTML = '<div class="no-items">Sin compras aprobadas</div>'; return; }
        el.innerHTML = docs.map(doc => {
            const p = doc.data();
            return `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${p.clienteEmail||'Cliente'}</h4>
                    <p style="font-size:12px">${(p.items||[]).map(i=>i.name).join(', ')}</p>
                    <p style="font-size:12px;color:var(--text-light)">${p.approvedAt?new Date(p.approvedAt).toLocaleDateString('es-AR'):''}</p>
                </div>
                <div style="text-align:right">
                    <div class="purchase-total">$${(p.total||0).toFixed(2)}</div>
                    <div style="font-size:12px;margin-top:4px">${p.paid?'✅ Pagada':'⏳ Sin pagar'}</div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadApprovedPurchasesMerchant:', e); }
}

// ============================================
// COMERCIANTE – PAGOS
// ============================================

async function loadPaymentsToApprove(comercianteId) {
    const el    = document.getElementById('paymentsToApprove');
    const badge = document.getElementById('pendingPaymentsBadge');
    if (!el) return;
    try {
        const snap = await db.collection(COL.PAYMENTS)
            .where('comercianteId','==', comercianteId)
            .where('approved','==', false)
            .where('rejected','==', false).get();

        const docs = snap.docs.sort((a,b) =>
            (b.data().date||'').localeCompare(a.data().date||''));

        if (badge) badge.textContent = docs.length;
        if (docs.length === 0) { el.innerHTML = '<div class="no-items">Sin pagos pendientes</div>'; return; }

        el.innerHTML = docs.map(doc => {
            const p = doc.data();
            return `
            <div class="purchase-item">
                <div class="purchase-info">
                    <h4>${p.userEmail||'Cliente'}</h4>
                    <p>${p.method==='efectivo'?'💵 Efectivo':'🏦 Transferencia'} · $${(p.amount||0).toFixed(2)}</p>
                    ${p.comprobante?`<p style="font-size:12px;color:var(--text-light)">Comp: ${p.comprobante}</p>`:''}
                    <p style="font-size:12px;color:var(--text-light)">${new Date(p.date).toLocaleDateString('es-AR')}</p>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <button class="btn btn-success" style="font-size:12px;padding:6px 12px"
                        onclick="approvePayment('${doc.id}','${p.userId}',${p.amount||0})">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-outline" style="font-size:12px;padding:6px 10px"
                        onclick="rejectPayment('${doc.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadPaymentsToApprove:', e); el.innerHTML = '<div class="no-items">Error al cargar pagos</div>'; }
}

async function approvePayment(paymentId, userId, amount) {
    const com = requireAuth();
    try {
        const payDoc = await db.collection(COL.PAYMENTS).doc(paymentId).get();
        const pd     = payDoc.data();

        await db.collection(COL.PAYMENTS).doc(paymentId).update({
            approved: true, approvedBy: com.uid, approvedAt: now()
        });

        if (pd?.purchaseId) {
            await db.collection(COL.PURCHASES).doc(pd.purchaseId).update({ paid: true, paidAt: now() });
        }

        if (typeof registrarCargo5pct === 'function') registrarCargo5pct(com.uid, amount);
        if (typeof sumarScoringPorPago === 'function') sumarScoringPorPago(userId, amount, 'cliente');
        if (typeof sumarVentasComerciante === 'function') sumarVentasComerciante(com.uid, amount);

        if (typeof crearNotificacion === 'function')
            crearNotificacion(userId,'✅ Tu pago fue aprobado. ¡Sumaste puntos!','success','fa-check-circle','green');

        showToast('Pago aprobado ✅','success');
        loadPaymentsToApprove(com.uid);
        updateMerchantStats(com.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
}

async function rejectPayment(paymentId) {
    const razon = prompt('Razón del rechazo:');
    if (!razon) return;
    const com = requireAuth();
    try {
        await db.collection(COL.PAYMENTS).doc(paymentId).update({
            rejected: true, rejectedBy: com.uid, rejectedAt: now(), rejectionReason: razon
        });
        showToast('Pago rechazado','info');
        loadPaymentsToApprove(com.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
}

// ============================================
// ESTADÍSTICAS
// ============================================

async function updateMerchantStats(comercianteId) {
    try {
        const [pSnap, aSnap, pySnap] = await Promise.all([
            db.collection(COL.PURCHASES).where('comercianteId','==',comercianteId).where('status','==','pending').get(),
            db.collection(COL.PURCHASES).where('comercianteId','==',comercianteId).where('status','==','approved').get(),
            db.collection(COL.PAYMENTS).where('comercianteId','==',comercianteId).where('approved','==',false).where('rejected','==',false).get(),
        ]);
        let totalVentas = 0;
        aSnap.forEach(d => { totalVentas += d.data().total || 0; });
        _setEl('pendingCount',    pSnap.size);
        _setEl('approvedCount',   aSnap.size);
        _setEl('totalSales',      `$${totalVentas.toFixed(0)}`);
        _setEl('pendingPayments', pySnap.size);
    } catch (e) { console.error('updateMerchantStats:', e); }
}

// ============================================
// FIADOS – COMERCIANTE
// ============================================

async function loadClientesFiado(comercianteId) {
    const el = document.getElementById('clientesFiado');
    if (!el) return;
    try {
        const snap = await db.collection(COL.USERS).doc(comercianteId).collection(COL.FIADOS).get();
        if (snap.empty) { el.innerHTML = '<div class="no-items">Sin clientes con crédito</div>'; return; }

        const ids    = snap.docs.map(d => d.id);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i+10));
        const emailMap = {};
        for (const chunk of chunks) {
            const us = await db.collection(COL.USERS)
                .where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
            us.forEach(d => { emailMap[d.id] = d.data().email||'Cliente'; });
        }

        el.innerHTML = snap.docs.map(doc => {
            const f    = doc.data();
            const disp = (f.monto_fiado||0) - (f.usado||0);
            return `
            <div class="purchase-item">
                <div style="flex:1">
                    <strong>${emailMap[doc.id]||'Cliente'}</strong>
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px">
                        <span>Límite: <strong>$${(f.monto_fiado||0).toFixed(2)}</strong></span>
                        <span>Usado: <strong>$${(f.usado||0).toFixed(2)}</strong></span>
                        <span style="color:var(--success)">Disp: <strong>$${disp.toFixed(2)}</strong></span>
                    </div>
                </div>
                <button class="btn btn-outline" style="font-size:11px;padding:6px 10px"
                    onclick="enviarDineroACliente('${doc.id}', ${disp})" title="Enviar dinero a su MP">
                    <i class="fas fa-hand-holding-usd"></i>
                </button>
            </div>`;
        }).join('');
    } catch (e) { console.error('loadClientesFiado:', e); }
}

async function cargarClientes() {
    const select = document.getElementById('clienteSelectComerciante');
    if (!select) return;
    try {
        const snap = await db.collection(COL.USERS).where('role','==','cliente').get();
        select.innerHTML = '<option value="">Seleccionar Cliente</option>';
        snap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().email;
            select.appendChild(opt);
        });
    } catch (e) { console.error('cargarClientes:', e); }
}

async function habilitarFiado() {
    const com      = requireAuth();
    const clienteId= document.getElementById('clienteSelectComerciante')?.value;
    const monto    = parseFloat(document.getElementById('montoFiado')?.value);
    if (!clienteId)     { showToast('Seleccioná un cliente','warning');   return; }
    if (!monto||monto<=0){ showToast('Ingresá un monto válido','warning'); return; }
    setButtonLoading('habilitarFiadoBtn', true);
    try {
        const cd = await db.collection(COL.USERS).doc(clienteId).get();
        await db.collection(COL.USERS).doc(com.uid).collection(COL.FIADOS).doc(clienteId).set({
            clienteId, clienteEmail: cd.exists?cd.data().email:'Cliente',
            monto_fiado: monto, usado: 0, activo: true,
            fecha_inicio: now(), updatedAt: now()
        }, { merge: true });
        showToast(`Crédito de $${monto.toFixed(2)} habilitado ✅`,'success');
        document.getElementById('clienteSelectComerciante').value = '';
        document.getElementById('montoFiado').value = '';
        loadClientesFiado(com.uid);
    } catch (e) { showToast(`Error: ${e.message}`,'error'); }
    finally { setButtonLoading('habilitarFiadoBtn', false); }
}

// ============================================
// NUEVO: CLIENTE — GUARDAR ALIAS DE MP DESDE SU PERFIL
// ============================================
// Requiere en el HTML del cliente algo como:
//   <input id="aliasMPInput" class="form-control" placeholder="tu.alias.mp">
//   <button onclick="guardarAliasMPDesdeInput()">Guardar</button>
// (guardarAliasMP() en sí vive en features.js)

function guardarAliasMPDesdeInput() {
    const val = document.getElementById('aliasMPInput')?.value;
    guardarAliasMP(val);
}

function closeApprovePaymentModal() {
    const m = document.getElementById('approvePaymentModal');
    if (m) m.style.display = 'none';
}

// ============================================
// DOM READY
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startPurchaseBtn') ?.addEventListener('click', startPurchase);
    document.getElementById('addItemBtn')        ?.addEventListener('click', addItemToList);
    document.getElementById('submitPurchaseBtn') ?.addEventListener('click', submitPurchase);
    document.getElementById('payBtn')            ?.addEventListener('click', openPaymentModal);
    document.getElementById('habilitarFiadoBtn') ?.addEventListener('click', habilitarFiado);
    document.getElementById('closePaymentModalBtn')?.addEventListener('click', closePaymentModal);
    document.getElementById('cancelPaymentBtn')  ?.addEventListener('click', closePaymentModal);
    document.getElementById('confirmPaymentBtn') ?.addEventListener('click', confirmPayment);
    document.getElementById('purchaseToPaySelect')?.addEventListener('change', loadPurchaseDetails);
    document.querySelectorAll('.category-buttons button').forEach(btn =>
        btn.addEventListener('click', () => selectCategory(btn.dataset.category)));
    document.querySelectorAll('.payment-option').forEach(opt =>
        opt.addEventListener('click', () => selectPaymentMethod(opt.dataset.method)));
});

// ---- Helpers ----
function _setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

// ---- Exports ----
window.selectCategory       = selectCategory;
window.removeItem           = removeItem;
window.pagarCompraDirecta   = pagarCompraDirecta;
window.selectPaymentMethod  = selectPaymentMethod;
window.closePaymentModal    = closePaymentModal;
window.closeNotification    = closeNotification;
window.approvePurchase      = approvePurchase;
window.rejectPurchase       = rejectPurchase;
window.approvePayment       = approvePayment;
window.rejectPayment        = rejectPayment;
window.closeApprovePaymentModal = closeApprovePaymentModal;
window.loadPurchasesToApprove   = loadPurchasesToApprove;
window.loadApprovedPurchasesMerchant = loadApprovedPurchasesMerchant;
window.loadPaymentsToApprove    = loadPaymentsToApprove;
window.loadClientesFiado        = loadClientesFiado;
window.cargarClientes           = cargarClientes;
window.updateMerchantStats      = updateMerchantStats;
window.loadClientPurchases      = loadClientPurchases;
window.loadMyFiados             = loadMyFiados;
window.loadPaymentHistory       = loadPaymentHistory;
window.loadUserScoring          = loadUserScoring;
window.guardarAliasMPDesdeInput = guardarAliasMPDesdeInput;
window.AppState                 = AppState;
window.startPurchase            = startPurchase;
window.addItemToList            = addItemToList;
window.submitPurchase           = submitPurchase;
window.openPaymentModal         = openPaymentModal;
window.habilitarFiado           = habilitarFiado;
window.confirmPayment           = confirmPayment;
window.loadPurchaseDetails      = loadPurchaseDetails;
window.setearVencimiento        = setearVencimiento;
window.prorrogarVencimiento     = prorrogarVencimiento;
window.noPuedoPagar             = noPuedoPagar;

// ============================================
// RENDER SCORING
// ============================================

function _renderScoring(d) {
    const pct = d.score < 500 ? (d.score - 300) / 200 * 33
              : d.score < 700 ? 33 + (d.score - 500) / 200 * 33
              :                 66 + (d.score - 700) / 300 * 34;

    const scoreValue = document.getElementById('scoreValue');
    if (scoreValue) scoreValue.textContent = d.score;

    const scoreBadge = document.getElementById('scoreBadge');
    if (scoreBadge) scoreBadge.textContent = `${d.score} pts`;

    const scoreDescription = document.getElementById('scoreDescription');
    if (scoreDescription) {
        scoreDescription.textContent =
            d.score < 500 ? '¡Usá crédito y pagá a tiempo para subir!' :
            d.score < 700 ? '¡Buen historial! Seguí así.' :
                            '¡Scoring excelente! Acceso total.';
    }

    const cat = document.getElementById('scoreCategory');
    if (cat) {
        cat.textContent = { low:'Bajo', medium:'Medio', high:'Alto' }[d.category] || d.category;
        cat.className   = `score-category ${d.category}`;
    }

    const fill = document.getElementById('scoreFill');
    if (fill) fill.style.width = `${Math.min(pct, 100)}%`;

    const bc = document.getElementById('scoreBenefits');
    if (!bc) return;
    bc.innerHTML = [
        { icon:'fa-shopping-cart', text:'Compras básicas',    ok: true },
        { icon:'fa-carrot',        text:'Verdulería',         ok: d.score >= 350 },
        { icon:'fa-drumstick-bite',text:'Carnicería',         ok: d.score >= 400 },
        { icon:'fa-pills',         text:'Farmacia',           ok: d.score >= 450 },
        { icon:'fa-tv',            text:'Electrodomésticos',  ok: d.score >= 700 },
    ].map(b => `<div class="benefit-item ${b.ok?'unlocked':'locked'}">
        <i class="fas ${b.icon}"></i><span>${b.text}</span></div>`).join('');
}

window._renderScoring = _renderScoring;
console.log('✅ app.js V5 cargado (duplicado de _renderPurchaseList eliminado)');