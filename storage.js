// Very small file-based storage for each server's catch log.
// NOTE: on most free hosts the filesystem is wiped on every redeploy/restart,
// so treat this as good-enough for a hobby project, not permanent storage.
// See README.md for how to upgrade to a real database later.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'catches.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

function readAll() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function addCatch(guildId, entry) {
  const all = readAll();
  if (!all[guildId]) all[guildId] = [];
  all[guildId].unshift(entry); // newest first
  writeAll(all);
}

function getCatches(guildId, { userId = null, limit = 10 } = {}) {
  const all = readAll();
  let list = all[guildId] || [];
  if (userId) list = list.filter((c) => c.userId === userId);
  return list.slice(0, limit);
}

module.exports = { addCatch, getCatches };
