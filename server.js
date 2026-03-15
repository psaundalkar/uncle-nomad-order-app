const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json());

// Order app routes BEFORE static so /order and /order/room1 etc. serve index.html
app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/order/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

function readJson(file) {
  const p = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    if (file === 'orders.json' || file === 'payments.json') return [];
    return null;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ——— API ———

// Menu & rooms
app.get('/api/menu', (req, res) => {
  res.json(readJson('menu.json'));
});

app.get('/api/rooms', (req, res) => {
  res.json(readJson('rooms.json'));
});

// Orders
app.get('/api/orders', (req, res) => {
  const status = req.query.status; // optional filter: placed|preparing|ready|delivered
  let orders = readJson('orders.json');
  if (status) orders = orders.filter(o => o.status === status);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/orders', (req, res) => {
  const { roomId, roomName, items, note } = req.body; // items: [{ menuItemId, name, price, qty }]
  if (!roomId || !roomName || !items || !items.length) {
    return res.status(400).json({ error: 'roomId, roomName and items required' });
  }
  const orders = readJson('orders.json');
  const total = items.reduce((sum, i) => sum + i.price * (i.qty || 1), 0);
  const order = {
    id: 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    roomId,
    roomName,
    items: items.map(i => ({ ...i, qty: i.qty || 1 })),
    total,
    note: note || '',
    status: 'placed',
    createdAt: new Date().toISOString(),
    preparedAt: null,
    deliveredAt: null,
  };
  orders.unshift(order);
  writeJson('orders.json', orders);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // preparing | ready | delivered
  if (!['preparing', 'ready', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const orders = readJson('orders.json');
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  order.status = status;
  if (status === 'ready') order.preparedAt = new Date().toISOString();
  if (status === 'delivered') order.deliveredAt = new Date().toISOString();
  writeJson('orders.json', orders);
  res.json(order);
});

// Room bills: only current rooms (101, 102, …); includes cleared amount and balance
app.get('/api/bills', (req, res) => {
  const orders = readJson('orders.json');
  const rooms = readJson('rooms.json');
  const payments = readJson('payments.json');
  const roomIds = new Set(rooms.map(r => r.id));
  const byRoom = {};
  rooms.forEach(r => {
    byRoom[r.id] = { roomId: r.id, roomName: r.name, total: 0, pending: 0, delivered: 0, cleared: 0, orderCount: 0 };
  });
  orders.forEach(o => {
    if (!roomIds.has(o.roomId)) return;
    byRoom[o.roomId].total += o.total;
    byRoom[o.roomId].orderCount += 1;
    if (o.status === 'delivered') byRoom[o.roomId].delivered += o.total;
    else byRoom[o.roomId].pending += o.total;
  });
  payments.forEach(p => {
    if (byRoom[p.roomId]) byRoom[p.roomId].cleared += p.amount || 0;
  });
  const result = Object.values(byRoom).map(b => ({
    ...b,
    balance: Math.max(0, b.total - b.cleared),
  }));
  res.json(result);
});

// Clear (mark as paid) a room's bill; records a payment for the current total
app.post('/api/bills/clear', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const rooms = readJson('rooms.json');
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(400).json({ error: 'Invalid room' });
  const orders = readJson('orders.json');
  const total = orders.filter(o => o.roomId === roomId).reduce((sum, o) => sum + o.total, 0);
  const payments = readJson('payments.json');
  const cleared = payments.filter(p => p.roomId === roomId).reduce((sum, p) => sum + (p.amount || 0), 0);
  const amount = total - cleared;
  if (amount <= 0) return res.status(400).json({ error: 'No balance to clear' });
  payments.push({ roomId, roomName: room.name, amount, clearedAt: new Date().toISOString() });
  writeJson('payments.json', payments);
  res.json({ roomId, amount, clearedAt: payments[payments.length - 1].clearedAt });
});

app.get('/staff', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

app.get('/menu-full', (req, res) => {
  res.sendFile(path.join(__dirname, 'Uncle Nomad Menu 2026.html'));
});

app.get('/', (req, res) => {
  res.redirect('/order');
});

app.listen(PORT, () => {
  console.log('Uncle Nomad Order App running at http://localhost:' + PORT);
  console.log('  Room links (for QR): /order/101, /order/102, ... /order/403 (see data/rooms.json)');
  console.log('  Staff: http://localhost:' + PORT + '/staff');
});
