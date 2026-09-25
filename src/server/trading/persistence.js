// ============================================================================
// Aurum Persistence Engine — Idempotency Store & Global Kill Switch
// Supports MongoDB persistence with memory fallback
// ============================================================================

const fs = require('fs');
const path = require('path');

const MEMORY_IDEMP_STORE = new Map();
let MEMORY_KILL_SWITCH = {
  active: false,
  reason: 'Normal Operations',
  updatedAt: new Date().toISOString()
};

const LOCAL_STORE_FILE = path.join(__dirname, '..', '..', '..', 'scratch', 'persistence_store.json');

function saveLocalState() {
  try {
    const dir = path.dirname(LOCAL_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = {
      killSwitch: MEMORY_KILL_SWITCH,
      idempotency: Array.from(MEMORY_IDEMP_STORE.entries())
    };
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.warn('[Persistence] Local store save error:', err.message);
  }
}

function loadLocalState() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.killSwitch) MEMORY_KILL_SWITCH = data.killSwitch;
      if (Array.isArray(data.idempotency)) {
        for (const [k, v] of data.idempotency) {
          MEMORY_IDEMP_STORE.set(k, v);
        }
      }
    }
  } catch (err) {
    console.warn('[Persistence] Local store load error:', err.message);
  }
}

loadLocalState();

async function getIdempotencyKey(db, key) {
  if (!key) return null;
  if (db) {
    try {
      const doc = await db.collection('idempotency_keys').findOne({ key });
      if (doc) return doc.order;
    } catch (err) {
      console.warn('[Persistence] DB idempotency read error:', err.message);
    }
  }
  return MEMORY_IDEMP_STORE.get(key) || null;
}

async function setIdempotencyKey(db, key, orderData) {
  if (!key) return;
  MEMORY_IDEMP_STORE.set(key, orderData);
  saveLocalState();

  if (db) {
    try {
      await db.collection('idempotency_keys').updateOne(
        { key },
        { $set: { key, order: orderData, createdAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('[Persistence] DB idempotency write error:', err.message);
    }
  }
}

async function getKillSwitchState(db) {
  if (db) {
    try {
      const doc = await db.collection('system_settings').findOne({ _id: 'global_kill_switch' });
      if (doc) {
        MEMORY_KILL_SWITCH = { active: doc.active, reason: doc.reason, updatedAt: doc.updatedAt };
      }
    } catch (err) {
      console.warn('[Persistence] DB kill switch read error:', err.message);
    }
  }
  return MEMORY_KILL_SWITCH;
}

async function setKillSwitchState(db, active, reason) {
  MEMORY_KILL_SWITCH = {
    active: Boolean(active),
    reason: reason || (active ? 'Emergency Halt Activated' : 'Normal Operations'),
    updatedAt: new Date().toISOString()
  };
  saveLocalState();

  if (db) {
    try {
      await db.collection('system_settings').updateOne(
        { _id: 'global_kill_switch' },
        { $set: { _id: 'global_kill_switch', active: MEMORY_KILL_SWITCH.active, reason: MEMORY_KILL_SWITCH.reason, updatedAt: MEMORY_KILL_SWITCH.updatedAt } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('[Persistence] DB kill switch write error:', err.message);
    }
  }
  return MEMORY_KILL_SWITCH;
}

module.exports = {
  getIdempotencyKey,
  setIdempotencyKey,
  getKillSwitchState,
  setKillSwitchState
};
