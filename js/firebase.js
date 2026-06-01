/**
 * Firebase Firestore - JS Agency Manager
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDr-sf1sHQZOZVo5C7eJT2Q--VPzWPI8z4',
  authDomain: 'jsagency.firebaseapp.com',
  projectId: 'jsagency',
  storageBucket: 'jsagency.firebasestorage.app',
  messagingSenderId: '995269733611',
  appId: '1:995269733611:web:545ab1ca56fb900f03a2ae'
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const COLLECTIONS = {
  clientes: 'clientes',
  sistemas: 'sistemas',
  ingresos: 'ingresos',
  configuracion: 'configuracion'
};

const CATEGORIAS_SISTEMA = [
  'Restaurante', 'Ferretería', 'Hotel', 'Inventario', 'POS',
  'Tienda Online', 'Clínica', 'Farmacia', 'Otro'
];

const ESTADOS_SISTEMA = [
  'Cotización', 'Desarrollo', 'Pruebas', 'Entregado', 'Soporte'
];

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Depósito', 'Otro'];

const FirebaseDB = {
  db,
  COLLECTIONS,

  sortByDate(items) {
    return items.sort((a, b) => {
      const ta = this._toMillis(a.createdAt) || this._toMillis(a.updatedAt) || 0;
      const tb = this._toMillis(b.createdAt) || this._toMillis(b.updatedAt) || 0;
      return tb - ta;
    });
  },

  _toMillis(val) {
    if (!val) return 0;
    if (val.toDate) return val.toDate().getTime();
    return new Date(val).getTime() || 0;
  },

  async getAll(collection) {
    const snap = await db.collection(collection).get();
    return this.sortByDate(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  },

  subscribe(collection, callback) {
    return db.collection(collection).onSnapshot(snap => {
      const data = this.sortByDate(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      callback(data);
    }, err => {
      console.error(`Error listening ${collection}:`, err);
      callback([]);
    });
  },

  async add(collection, data) {
    const payload = {
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection(collection).add(payload);
    return ref.id;
  },

  async update(collection, id, data) {
    await db.collection(collection).doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async remove(collection, id) {
    await db.collection(collection).doc(id).delete();
  },

  async getDoc(collection, docId) {
    const doc = await db.collection(collection).doc(docId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async setDoc(collection, docId, data, merge = true) {
    await db.collection(collection).doc(docId).set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge });
  },

  async batchSet(collection, items) {
    const batch = db.batch();
    items.forEach(item => {
      const id = item.id || db.collection(collection).doc().id;
      const { id: _id, ...rest } = item;
      const ref = db.collection(collection).doc(id);
      batch.set(ref, {
        ...rest,
        createdAt: rest.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  },

  async clearCollection(collection) {
    const snap = await db.collection(collection).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  async importBackup(data) {
    const collections = ['clientes', 'sistemas', 'ingresos'];
    for (const col of collections) {
      await this.clearCollection(col);
      if (data[col] && data[col].length) {
        const items = data[col];
        for (let i = 0; i < items.length; i += 400) {
          const chunk = items.slice(i, i + 400);
          const batch = db.batch();
          chunk.forEach(item => {
            const docId = item.id || db.collection(col).doc().id;
            const { id: _id, ...rest } = item;
            const ref = db.collection(col).doc(docId);
            batch.set(ref, {
              ...rest,
              createdAt: rest.createdAt || new Date().toISOString(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await batch.commit();
        }
      }
    }
    if (data.configuracion) {
      await this.setDoc(COLLECTIONS.configuracion, 'general', data.configuracion);
    }
  }
};
