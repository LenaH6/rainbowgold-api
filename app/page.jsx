'use client';
import { useEffect, useState } from 'react';

/**
 * NOTE: MiniKit in-app SDK usually runs inside World App webview.
 * Here we provide placeholders. Plug your real MiniKit imports when ready:
 *   import { MiniKit } from '@worldcoin/minikit'; (example name)
 */
export default function Home() {
  const [status, setStatus] = useState('idle');
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);

  // --- LOGIN (MiniKit) ---
  async function handleLogin() {
    try {
      setStatus('connecting');
      // 1) Request verification via MiniKit (pseudo-code)
      // const proof = await MiniKit.verify({ action: 'login' });
      const proof = { merkle_root:'', nullifier_hash:'demo-nullifier', proof:'0x', verification_level:'device' };
      // 2) Send to backend to verify & restore progress
      const r = await fetch('/api/verify', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(proof)});
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'Verification failed');
      setToken(data.token); setUserId(data.userId); setStatus('logged');
    } catch(e) {
      console.error(e); setStatus('error');
    }
  }

  // --- PAYMENT (MiniKit) ---
  async function handlePay() {
    try {
      if (!token) throw new Error('Primero inicia sesión');
      // const payRes = await MiniKit.pay({ amount: '0.1', currency: 'WORLD', memo: 'Compra energía' });
      // Enviar confirmación a backend
      const r = await fetch('/api/pay/confirm', { method:'POST', headers:{'content-type':'application/json', 'authorization':`Bearer ${token}`}, body: JSON.stringify({ orderId:'demo', status:'confirmed' }) });
      const data = await r.json();
      alert(data.ok ? 'Pago confirmado' : (data.error || 'Error'));
    } catch(e) {
      alert(e.message);
    }
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-6 space-y-8">
      <h1 className="text-3xl font-bold">RainbowGold — Next + MiniKit</h1>

      <section className="space-y-3 rounded-2xl p-5 bg-zinc-900">
        <h2 className="text-xl font-semibold">Inicio de sesión (MiniKit)</h2>
        <p className="opacity-80">Inicia sesión con World ID dentro de World App. Este botón simula la verificación y llama a <code>/api/verify</code>.</p>
        <button onClick={handleLogin} className="rounded-xl px-4 py-2 bg-white text-black font-medium">Entrar con World ID</button>
        <div className="text-sm opacity-80">Estado: {status} {userId && <>· ID: <code>{userId}</code></>}</div>
      </section>

      <section className="space-y-3 rounded-2xl p-5 bg-zinc-900">
        <h2 className="text-xl font-semibold">Pagos (MiniKit)</h2>
        <p className="opacity-80">Ejemplo de compra dentro de la miniapp y confirmación en <code>/api/pay/confirm</code>.</p>
        <button onClick={handlePay} className="rounded-xl px-4 py-2 bg-white text-black font-medium">Comprar / Confirmar</button>
      </section>
    </main>
  );
}
