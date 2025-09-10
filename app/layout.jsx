export const metadata = { title: 'RainbowGold Next MiniKit', description: 'Next.js + World App MiniKit scaffold' };
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-white">{children}</body>
    </html>
  );
}
