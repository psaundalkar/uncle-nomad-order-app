const API = '';

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(API + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function post(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDeliveredAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function renderOrderCard(o, isPast) {
  const itemsList = o.items.map(i => `<li><span>${i.name} × ${i.qty}</span><span>₹ ${i.price * i.qty}</span></li>`).join('');
  const canPreparing = !isPast && o.status === 'placed';
  const canReady = !isPast && o.status === 'preparing';
  const canDelivered = !isPast && o.status === 'ready';
  const actionsHtml = isPast
    ? ''
    : `<div class="order-actions">
      ${canPreparing ? `<button type="button" class="btn-preparing" data-action="preparing">Preparing</button>` : ''}
      ${canReady ? `<button type="button" class="btn-ready" data-action="ready">Ready</button>` : ''}
      ${canDelivered ? `<button type="button" class="btn-delivered" data-action="delivered">Delivered</button>` : ''}
    </div>`;
  const deliveredInfo = isPast && o.deliveredAt
    ? `<p class="order-delivered-at">Delivered ${formatDeliveredAt(o.deliveredAt)}</p>`
    : '';
  return `
    <div class="order-card order-card-${isPast ? 'past' : 'live'}" data-order-id="${o.id}">
      <div class="order-head">
        <span class="room-badge">${o.roomName}</span>
        <span class="time">${formatTime(o.createdAt)}</span>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
      <div class="order-body">
        <ul>${itemsList}</ul>
        <div class="total-row">Total — ₹ ${o.total}</div>
        ${o.note ? `<p style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">Note: ${o.note}</p>` : ''}
        ${deliveredInfo}
      </div>
      ${actionsHtml}
    </div>
  `;
}

function renderOrdersList(orders, listId, emptyId, isPast) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!orders.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = orders.map(o => renderOrderCard(o, isPast)).join('');

  if (!isPast) {
    list.querySelectorAll('.order-actions button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.order-card');
        const id = card.dataset.orderId;
        const status = btn.dataset.action;
        try {
          await patch('/api/orders/' + id, { status });
          loadOrders();
        } catch (e) {
          alert('Failed to update order.');
          console.error(e);
        }
      });
    });
  }
}

function renderOrders(liveOrders, pastOrders) {
  renderOrdersList(liveOrders, 'orders-live-list', 'orders-live-empty', false);
  renderOrdersList(pastOrders, 'orders-past-list', 'orders-past-empty', true);
}

function renderBills(bills) {
  const list = document.getElementById('bills-list');
  list.innerHTML = bills.map(b => {
    const hasBalance = b.balance > 0;
    return `
    <div class="bill-card" data-room-id="${b.roomId}">
      <h3>${b.roomName}</h3>
      <div class="row pending">Pending (not delivered): ₹ ${b.pending}</div>
      <div class="row">Delivered: ₹ ${b.delivered}</div>
      <div class="row total">Total: ₹ ${b.total}</div>
      <div class="row cleared">Cleared (paid): ₹ ${b.cleared || 0}</div>
      <div class="row balance">Balance due: ₹ ${b.balance || 0}</div>
      <div class="row" style="font-size: 0.85rem; color: var(--text-muted);">${b.orderCount} order(s)</div>
      ${hasBalance ? `<button type="button" class="btn-clear-bill">Clear bill (mark paid)</button>` : '<span class="bill-cleared-badge">Cleared</span>'}
    </div>
  `;
  }).join('');

  list.querySelectorAll('.btn-clear-bill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.bill-card');
      const roomId = card.dataset.roomId;
      const roomName = card.querySelector('h3').textContent;
      if (!confirm(`Mark bill for ${roomName} as paid? This will clear the balance due.`)) return;
      try {
        await post('/api/bills/clear', { roomId });
        loadBills();
      } catch (e) {
        alert(e.message || 'Failed to clear bill.');
        console.error(e);
      }
    });
  });
}

async function loadOrders() {
  try {
    const orders = await get('/api/orders');
    const liveOrders = orders.filter(o => o.status !== 'delivered');
    const pastOrders = orders.filter(o => o.status === 'delivered');
    renderOrders(liveOrders, pastOrders);
  } catch (e) {
    document.getElementById('orders-live-list').innerHTML = '<div class="empty-state">Failed to load orders.</div>';
    console.error(e);
  }
}

async function loadBills() {
  try {
    const bills = await get('/api/bills');
    renderBills(bills);
  } catch (e) {
    document.getElementById('bills-list').innerHTML = '<div class="empty-state">Failed to load bills.</div>';
    console.error(e);
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-orders').style.display = tab.dataset.tab === 'orders' ? 'block' : 'none';
    document.getElementById('panel-bills').style.display = tab.dataset.tab === 'bills' ? 'block' : 'none';
    if (tab.dataset.tab === 'bills') loadBills();
  });
});

loadOrders();
setInterval(loadOrders, 8000);
loadBills();
