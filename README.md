# Uncle Nomad Homestay – Order App

Web app for guests to order food/drinks by room. Staff see orders and mark them prepared/delivered. Bills are tracked per room.

## Features

- **Guest (QR in room):** Each room has its own link. Guest scans the QR in their room → Opens menu directly → Add to cart → Place order. Bill is automatically tied to that room. Optional link to full PDF-style menu.
- **Staff:** View incoming orders, mark as **Preparing** → **Ready** → **Delivered**. View **Room bills** (pending vs delivered, total per room).
- **Rooms:** 12 rooms (101, 102, 103, 201, 202, 203, 301, 302, 304, 401, 402, 403). Editable in `data/rooms.json`.
- **Menu:** Editable in `data/menu.json` (categories and items with name & price).

## Quick start

```bash
npm install
npm start
```

- **Rooms:** http://localhost:3000/order/101, /order/102, /order/103, /order/201, /order/202, /order/203, /order/301, /order/302, /order/304, /order/401, /order/402, /order/403  
- **Staff app:** http://localhost:3000/staff  
- **Full menu (PDF style):** http://localhost:3000/menu-full  

## QR codes for guests (one per room)

Use a **different URL for each room** so the bill is automatically assigned to the right room. Generate one QR per room:

| Room    | URL (local)                  |
|---------|------------------------------|
| 101–103 | `.../order/101`, `.../order/102`, `.../order/103` |
| 201–203 | `.../order/201`, `.../order/202`, `.../order/203` |
| 301, 302, 304 | `.../order/301`, `.../order/302`, `.../order/304` |
| 401–403 | `.../order/401`, `.../order/402`, `.../order/403` |

Replace `...` with `http://YOUR_IP:3000` (or your production URL). One QR per room.

- Replace `YOUR_IP` with your server IP (e.g. `192.168.1.10`) or use `localhost` only if testing on the same device.
- In production use `https://your-domain.com/order/room1`, etc.
- If someone opens `/order` without a room (e.g. plain `/order`), they see a message to use the QR code in their room.

## Editing menu & rooms

- **Menu:** Edit `data/menu.json`. Each category has `id`, `name`, and `items` array. Each item: `id`, `name`, `price` (number).
- **Rooms:** Edit `data/rooms.json`. Each room: `id` (e.g. `101` for URL `/order/101`), `name` (e.g. `Room 101`).

## Order flow

1. Guest scans the QR in their room (e.g. opens `/order/room2`) → menu opens with their room already set. They add items and place order.
2. Order appears on staff dashboard (`/staff` → Orders). Staff can mark: **Preparing** → **Ready** → **Delivered**.
3. **Room bills** tab shows per room: pending amount (not yet delivered), delivered amount, and total. Use this for checkout/billing.

## Data storage

Orders are stored in `data/orders.json`. Back up this folder if you need to keep history.

## Deploying (e.g. same WiFi / VPS)

- On your **local network:** Run `npm start`, find your machine’s IP (e.g. `192.168.1.10`). Use `http://192.168.1.10:3000/order/101`, `.../order/102`, etc. for each room’s QR code. Staff use `http://192.168.1.10:3000/staff` on their phones.
- For **internet access:** Deploy to a VPS (Node.js), use a process manager (e.g. `pm2`), and put the app behind HTTPS. Then use `https://your-domain.com/order/room1`, etc., in the QR codes.
