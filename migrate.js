// ============================================
// CLUBALMACÉN V5 – migrate.js
// Ejecutar desde la consola del navegador (F12)
// después de iniciar sesión en la app.
// Llamar: migrateAll()
// ============================================

async function migrateAll() {
    console.log('🚀 Iniciando migración completa...');
    await unificarUsers();
    await unificarCompras();
    await repararPayments();
    console.log('✅ Migración completa. Recargá la app.');
}

// TAREA 1: user (singular) → users (plural)
async function unificarUsers() {
    console.log('🔄 Migrando user → users...');
    const snap = await db.collection('user').get();
    console.log(`📊 Encontrados ${snap.size} documentos en "user"`);
    if (snap.empty) { console.log('ℹ️ Sin datos en "user". OK.'); return; }

    const batch = db.batch();
    snap.forEach(doc => {
        const data = { ...doc.data() };
        if (!data.role)      data.role      = 'cliente';
        if (!data.email)     data.email     = doc.id + '@migrado.com';
        if (!data.createdAt) data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        batch.set(db.collection('users').doc(doc.id), data, { merge: true });
    });
    await batch.commit();
    console.log(`✅ ${snap.size} usuarios migrados a "users"`);
}

// TAREA 2: compras_fiado → purchases
async function unificarCompras() {
    console.log('🔄 Migrando compras_fiado → purchases...');
    const snap = await db.collection('compras_fiado').get();
    console.log(`📊 Encontradas ${snap.size} compras en "compras_fiado"`);
    if (snap.empty) { console.log('ℹ️ Sin datos en "compras_fiado". OK.'); return; }

    const batch = db.batch();
    snap.forEach(doc => {
        const d = doc.data();
        const normalized = {
            clienteId:     d.clienteId     || d.userId      || d.cliente_id   || null,
            clienteEmail:  d.clienteEmail  || d.email       || '',
            comercianteId: d.comercianteId || d.comerciante_id || null,
            total:         d.total         || d.monto        || 0,
            status:        d.status        || d.estado       || 'pending',
            paid:          d.paid          || d.pagado       || false,
            items:         d.items         || d.productos    || [],
            category:      d.category      || d.categoria    || 'general',
            createdAt:     d.createdAt     || d.fecha        || new Date().toISOString(),
            origen:        'migrado'
        };
        batch.set(db.collection('purchases').doc(doc.id), normalized, { merge: true });
    });
    await batch.commit();
    console.log(`✅ ${snap.size} compras migradas a "purchases"`);
}

// TAREA 3: Reparar payments (userId vs userID, agregar comercianteId)
async function repararPayments() {
    console.log('🔄 Reparando payments...');
    const snap = await db.collection('payments').get();
    console.log(`📊 Encontrados ${snap.size} pagos`);
    if (snap.empty) { console.log('ℹ️ Sin pagos. OK.'); return; }

    let count = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        const updates = {};
        let needs = false;

        // Corregir userID (mayúscula) → userId
        if (d.userID && !d.userId) {
            updates.userId = d.userID;
            needs = true;
        }

        // Agregar campo approved/rejected si faltan
        if (d.approved === undefined) { updates.approved = false; needs = true; }
        if (d.rejected === undefined) { updates.rejected = false; needs = true; }

        // Agregar date si falta
        if (!d.date) {
            updates.date = d.fecha || d.createdAt || new Date().toISOString();
            needs = true;
        }

        // Agregar comercianteId desde la compra si falta
        if (!d.comercianteId && d.purchaseId) {
            try {
                const purchase = await db.collection('purchases').doc(d.purchaseId).get();
                if (purchase.exists && purchase.data().comercianteId) {
                    updates.comercianteId = purchase.data().comercianteId;
                    needs = true;
                }
            } catch(e) { console.warn('Error buscando compra:', d.purchaseId); }
        }

        if (needs) {
            await doc.ref.update(updates);
            count++;
        }
    }
    console.log(`✅ ${count} pagos actualizados`);
}

// Exportar para usar desde consola
window.migrateAll      = migrateAll;
window.unificarUsers   = unificarUsers;
window.unificarCompras = unificarCompras;
window.repararPayments = repararPayments;

console.log('📦 migrate.js cargado. Ejecutá migrateAll() para migrar los datos.');
