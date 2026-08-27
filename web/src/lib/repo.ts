/**
 * Penulis berkas ke repo GitHub, dijalankan DI SERVER.
 *
 * Tokennya ada di environment variable Vercel, tidak pernah sampai ke browser.
 * Itu syaratnya kalau autentikasinya cuma password: kredensial tulis harus
 * berada di tempat yang tidak bisa dibaca pengunjung.
 */
const API = 'https://api.github.com';

function repoEnv() {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const slug = import.meta.env.GITHUB_REPO ?? process.env.GITHUB_REPO ?? 'rhmatzeka/ITSME';
  const branch = import.meta.env.GITHUB_BRANCH ?? process.env.GITHUB_BRANCH ?? 'main';
  if (!token) throw new Error('GITHUB_TOKEN belum diset di environment Vercel.');
  const [owner, repo] = slug.split('/');
  return { token, owner, repo, branch };
}

async function req(path: string, init: RequestInit = {}) {
  const { token, owner, repo } = repoEnv();
  const res = await fetch(`${API}/repos/${owner}/${repo}/${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mapporto-admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

async function sha(jalur: string) {
  const { branch } = repoEnv();
  try {
    const r = await req(`contents/${encodeURI(jalur)}?ref=${branch}`);
    return Array.isArray(r) ? undefined : (r.sha as string);
  } catch {
    return undefined;
  }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

export async function tulis(jalur: string, isi: string, pesan: string) {
  const { branch } = repoEnv();
  return req(`contents/${encodeURI(jalur)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: pesan, content: b64(isi), branch, sha: await sha(jalur) }),
  });
}

export async function tulisBase64(jalur: string, base64: string, pesan: string) {
  const { branch } = repoEnv();
  return req(`contents/${encodeURI(jalur)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: pesan, content: base64, branch, sha: await sha(jalur) }),
  });
}

export async function hapus(jalur: string, pesan: string) {
  const { branch } = repoEnv();
  const s = await sha(jalur);
  if (!s) throw new Error('Berkasnya tidak ada.');
  return req(`contents/${encodeURI(jalur)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: pesan, branch, sha: s }),
  });
}

export async function daftar(folder: string): Promise<string[]> {
  const { branch } = repoEnv();
  try {
    const r = await req(`contents/${encodeURI(folder)}?ref=${branch}`);
    return Array.isArray(r) ? r.filter((f: any) => f.type === 'file').map((f: any) => f.name) : [];
  } catch {
    return [];
  }
}

export async function baca(jalur: string): Promise<string | null> {
  const { branch } = repoEnv();
  try {
    const r = await req(`contents/${encodeURI(jalur)}?ref=${branch}`);
    return Buffer.from(r.content, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

export function keSlug(judul: string) {
  return (
    judul
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'projek'
  );
}

const kutip = (v: string) => JSON.stringify(v ?? '');

export function keMarkdown(p: {
  title: string; summary: string; stack: string[];
  year?: number; repo?: string; demo?: string; order: number; body: string;
}) {
  return [
    '---',
    `title: ${kutip(p.title)}`,
    `summary: ${kutip(p.summary)}`,
    `stack: [${p.stack.map(kutip).join(', ')}]`,
    ...(p.year ? [`year: ${p.year}`] : []),
    ...(p.repo ? [`repo: ${kutip(p.repo)}`] : []),
    ...(p.demo ? [`demo: ${kutip(p.demo)}`] : []),
    `order: ${p.order}`,
    '---',
    '',
    p.body.trim(),
    '',
  ].join('\n');
}
