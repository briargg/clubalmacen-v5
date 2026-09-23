// ============================================
// CLUBALMACÉN V5 – firebase.js
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyB89PuH-5zSpQpI1QASHrEcrQvtUWsDn7A",
    authDomain: "clubalmacen.firebaseapp.com",
    projectId: "clubalmacen",
    storageBucket: "clubalmacen.appspot.com",
    messagingSenderId: "284091950744",
    appId: "1:284091950744:web:578d9d1aae581225d592ed"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db   = firebase.firestore();

// Nombres canónicos de colecciones
window.COL = {
    USERS:              'users',
    PURCHASES:          'purchases',
    PAYMENTS:           'payments',
    FIADOS:             'fiados',
    SCORING:            'scoring',
    VAQUITAS:           'vaquitas',
    APORTES:            'aportes',
    PERFILES_COMERCIOS: 'perfilesComercios',
    OFERTAS:            'ofertas',
    NOTIFICACIONES:     'notificaciones',
    CUPONES_USADOS:     'cuponesUsados',
    CARGOS:             'cargosAcumulados',
    CARGOS_MANT:        'cargosMantenimiento',
};

window.requireAuth = () => {
    const u = auth.currentUser;
    if (!u) throw new Error('No autenticado');
    return u;
};

window.now = () => new Date().toISOString();

// Persistencia offline (PWA)
db.enablePersistence({ synchronizeTabs: true })
  .catch(e => console.warn('Persistencia:', e.code));

console.log('✅ firebase.js cargado');
