const API = '';

function getRoomFromUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // /order/room1 -> ['order', 'room1'], /order -> ['order']
  if (parts[0] === 'order' && parts[1]) return parts[1];
  return null;
}

async function get(path) {
  const res = await fetch(API + path);
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

let state = {
  rooms: [],
  menu: [],
  selectedRoom: null,
  roomFromUrl: false, // true when room came from URL (QR)
  cart: [],
};

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('step-' + stepId);
  if (el) el.classList.add('active');

  if (stepId === 'menu') {
    document.getElementById('cart-bar').style.display = state.cart.length ? 'flex' : 'none';
  } else if (stepId === 'cart') {
    document.getElementById('cart-bar').style.display = 'none';
  } else {
    document.getElementById('cart-bar').style.display = 'none';
  }
}

function setRoomFromUrl(roomId) {
  const room = state.rooms.find(r => r.id === roomId);
  if (room) {
    state.selectedRoom = { id: room.id, name: room.name };
    state.roomFromUrl = true;
    return true;
  }
  return false;
}

function renderCategories() {
  const container = document.getElementById('category-tabs');
  container.innerHTML = state.menu.map((cat, i) => `
    <button type="button" class="category-tab ${i === 0 ? 'active' : ''}" data-index="${i}">${cat.name}</button>
  `).join('');
  container.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenuItems(parseInt(btn.dataset.index, 10));
    });
  });
  if (state.menu.length) renderMenuItems(0);
}

function renderMenuItems(categoryIndex) {
  const cat = state.menu[categoryIndex];
  if (!cat) return;
  const list = document.getElementById('menu-list');
  list.innerHTML = cat.items.map(item => {
    const inCart = state.cart.find(c => c.id === item.id);
    const qty = inCart ? inCart.qty : 0;
    return `
      <div class="menu-item" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
        <div class="info">
          <div class="name">${item.name}</div>
          <div class="price">₹ ${item.price}</div>
        </div>
        <div class="qty-controls">
          <button type="button" aria-label="Decrease">−</button>
          <span class="qty-num">${qty}</span>
          <button type="button" aria-label="Increase">+</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.menu-item').forEach(row => {
    const id = row.dataset.id;
    const name = row.dataset.name;
    const price = parseInt(row.dataset.price, 10);
    const minus = row.querySelector('.qty-controls button:first-child');
    const plus = row.querySelector('.qty-controls button:last-child');
    const qtyEl = row.querySelector('.qty-num');

    function updateQty(delta) {
      let entry = state.cart.find(c => c.id === id);
      if (!entry) {
        entry = { id, name, price, qty: 0 };
        state.cart.push(entry);
      }
      entry.qty = Math.max(0, entry.qty + delta);
      if (entry.qty === 0) state.cart = state.cart.filter(c => c.id !== id);
      qtyEl.textContent = entry.qty;
      updateCartBar();
    }

    minus.addEventListener('click', () => updateQty(-1));
    plus.addEventListener('click', () => updateQty(1));
  });
}

function updateCartBar() {
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-total').textContent = '₹ ' + total;
  document.getElementById('cart-count').textContent = count + ' item' + (count !== 1 ? 's' : '');
  document.getElementById('cart-bar').style.display = count ? 'flex' : 'none';
  const activeTab = document.querySelector('.category-tab.active');
  if (activeTab) renderMenuItems(parseInt(activeTab.dataset.index, 10));
}

function renderCart() {
  document.getElementById('cart-room-label').textContent = state.selectedRoom ? state.selectedRoom.name : '';
  const list = document.getElementById('cart-list');
  if (!state.cart.length) {
    list.innerHTML = '<li style="padding: 1rem; color: var(--text-muted);">Cart is empty.</li>';
    return;
  }
  list.innerHTML = state.cart.map(i => `
    <li>
      <span>${i.name} × ${i.qty}</span>
      <span class="sub">₹ ${i.price * i.qty}</span>
    </li>
  `).join('') + `
    <li class="total-row">
      <span>Total</span>
      <span>₹ ${state.cart.reduce((s, i) => s + i.price * i.qty, 0)}</span>
    </li>
  `;
}

function applyRoomFromUrlUi() {
  const changeRoomBtn = document.getElementById('btn-change-room');
  if (changeRoomBtn) changeRoomBtn.style.display = state.roomFromUrl ? 'none' : '';
}

async function init() {
  try {
    const [rooms, menu] = await Promise.all([get('/api/rooms'), get('/api/menu')]);
    state.rooms = rooms;
    state.menu = menu;

    const urlRoomId = getRoomFromUrl();
    if (urlRoomId && setRoomFromUrl(urlRoomId)) {
      // Room in URL (QR): go straight to menu
      document.getElementById('selected-room-label').textContent = state.selectedRoom.name;
      document.querySelector('.header h1').textContent = state.selectedRoom.name;
      document.querySelector('.header p').textContent = 'Choose from the menu below';
      showStep('menu');
      renderCategories();
      applyRoomFromUrlUi();
    } else {
      // No room or invalid room: show "use QR" message
      showStep('no-room');
    }

    document.getElementById('btn-view-cart').addEventListener('click', () => {
      renderCart();
      showStep('cart');
    });
    document.getElementById('btn-back-to-menu').addEventListener('click', () => showStep('menu'));
    document.getElementById('btn-place-order').addEventListener('click', placeOrder);
    document.getElementById('btn-new-order').addEventListener('click', () => {
      state.cart = [];
      document.getElementById('selected-room-label').textContent = state.selectedRoom.name;
      showStep('menu');
      renderCategories();
      updateCartBar();
    });
  } catch (e) {
    alert('Could not load menu. Please check your connection and try again.');
    console.error(e);
  }
}

async function placeOrder() {
  if (!state.selectedRoom || !state.cart.length) return;
  const note = document.getElementById('order-note').value.trim();
  const items = state.cart.map(i => ({ menuItemId: i.id, name: i.name, price: i.price, qty: i.qty }));
  try {
    await post('/api/orders', {
      roomId: state.selectedRoom.id,
      roomName: state.selectedRoom.name,
      items,
      note,
    });
    state.cart = [];
    document.getElementById('order-note').value = '';
    showStep('done');
  } catch (e) {
    alert('Failed to place order. Please try again.');
    console.error(e);
  }
}

init();
