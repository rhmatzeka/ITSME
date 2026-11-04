import { RUTE } from '../rute';

const SITUS = 'https://www.rahmateka.my.id';

/** Semua alamat publik; /admin sengaja tidak ikut. */
export function GET() {
  const alamat = ['/', ...RUTE.map((r) => `/${r.ruas}`)];
  const isi = alamat.map((a) => `  <url><loc>${SITUS}${a}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${isi}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
