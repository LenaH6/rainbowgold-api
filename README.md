# RainbowGold — Next.js + MiniKit scaffold

This repo migrates your previous `/api/*` endpoints into **Next.js 14 App Router** under `/app/api/*` and adds a minimal client
with two flows:
- **Login (World ID via MiniKit)** -> calls `/api/verify` to issue a JWT and restore progress from Upstash Redis.
- **Payment (MiniKit)** -> calls `/api/pay/confirm` to persist a mock confirmation.

## Getting started

```bash
pnpm i   # or npm i
cp .env.example .env.local
pnpm dev # or npm run dev
```

Open http://localhost:3000

## Notes

- Endpoints converted from your original repo. Check files under `app/api/**/route.js`.
- Replace the placeholder MiniKit calls in `app/page.jsx` with real SDK calls inside World App.
- CORS headers kept in route handlers for compatibility with external clients.


## MiniKit (World App) backend ready

### 1) Login / Verificación World ID
- **Endpoint:** `POST /api/minikit/verify`
- **Body esperado (desde MiniKit/World App):**
```json
{
  "action": "<tu_action_id>",
  "signal": "<opcional>",
  "proof": "...",
  "merkle_root": "...",
  "nullifier_hash": "...",
  "verification_level": "device"
}
```
- **Respuesta:** `{ ok, userId, token }` donde `token` es JWT (úsalo en `Authorization: Bearer <token>`).

### 2) Perfil
- **GET /api/minikit/me**: con `Authorization: Bearer` te devuelve el usuario guardado.

### 3) Pagos (crear y confirmar)
- **POST /api/minikit/pay/create** con `{ amount, currency, memo? }` -> crea `orderId` pendiente y lo guarda.
- **POST /api/minikit/pay/confirm** con `{ orderId, txHash?, chain?, status? }` -> marca confirmado y guarda TX.

> Nota: la verificación de firma de webhooks de pagos puede añadirse si deseas recibir confirmaciones servidor-a-servidor.

### 4) Sugerencias & Votos (con admin)
- **GET/POST /api/suggestions** para listar y crear. `DELETE` requiere admin.
- **POST /api/votes** con `{ suggestionId, delta: 1|-1 }` vota por sugerencias.
- **GET /api/votes?suggestionId=...`** devuelve el zset de votos.

## Variables de entorno
```
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
JWT_SECRET=
WORLD_ID_APP_ID=
WORLD_ID_VERIFY_ENDPOINT=https://developer.worldcoin.org/api/v2/verify
ADMIN_USER_IDS= # coma-separado de nullifiers admin (opcional)
```
