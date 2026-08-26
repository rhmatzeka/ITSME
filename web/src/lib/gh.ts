/**
 * Klien GitHub Contents API seukuran seperlunya.
 *
 * Halaman admin menyimpan projek sebagai berkas Markdown langsung ke repo,
 * dan Vercel membangun ulang situs begitu commit-nya masuk. Repo tetap jadi
 * satu-satunya sumber kebenaran — tidak ada basis data terpisah yang bisa
 * melenceng dari isi repo.
 *
 * Tokennya tinggal di browser kamu (localStorage) dan dipakai langsung dari
 * sana. Tidak ada server perantara yang menyimpannya, dan situsnya tetap
 * statis sepenuhnya. Konsekuensinya token itu ada di perangkat kamu: pakai
 * fine-grained token yang cuma boleh menyentuh repo ini.
 */

const API = 'https://api.github.com';

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

async function req(ref: RepoRef, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/repos/${ref.owner}/${ref.repo}/${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${ref.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const teks = await res.text();
    throw new Error(`GitHub ${res.status}: ${teks.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Cek token sekaligus pastikan repo-nya benar-benar bisa ditulis. */
export async function cekAkses(ref: RepoRef) {
  const r = await req(ref, '');
  if (!r.permissions?.push) throw new Error('Token tidak punya izin tulis ke repo ini.');
  return { nama: r.full_name, cabang: r.default_branch };
}

/** SHA berkas — wajib disertakan saat menimpa berkas yang sudah ada. */
async function shaBerkas(ref: RepoRef, jalur: string): Promise<string | undefined> {
  try {
    const r = await req(ref, `contents/${encodeURI(jalur)}?ref=${ref.branch}`);
    return Array.isArray(r) ? undefined : r.sha;
  } catch {
    return undefined; // belum ada — berarti membuat baru
  }
}

const keBase64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

export async function tulisBerkas(ref: RepoRef, jalur: string, isi: string, pesan: string) {
  return req(ref, `contents/${encodeURI(jalur)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: pesan,
      content: keBase64(isi),
      branch: ref.branch,
      sha: await shaBerkas(ref, jalur),
    }),
  });
}

export async function tulisBiner(ref: RepoRef, jalur: string, base64: string, pesan: string) {
  return req(ref, `contents/${encodeURI(jalur)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: pesan,
      content: base64,
      branch: ref.branch,
      sha: await shaBerkas(ref, jalur),
    }),
  });
}

export async function hapusBerkas(ref: RepoRef, jalur: string, pesan: string) {
  const sha = await shaBerkas(ref, jalur);
  if (!sha) throw new Error('Berkasnya tidak ada.');
  return req(ref, `contents/${encodeURI(jalur)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: pesan, branch: ref.branch, sha }),
  });
}

export async function daftarBerkas(ref: RepoRef, folder: string): Promise<string[]> {
  try {
    const r = await req(ref, `contents/${encodeURI(folder)}?ref=${ref.branch}`);
    return Array.isArray(r) ? r.filter((f) => f.type === 'file').map((f) => f.name) : [];
  } catch {
    return [];
  }
}

export async function bacaBerkas(ref: RepoRef, jalur: string): Promise<string | null> {
  try {
    const r = await req(ref, `contents/${encodeURI(jalur)}?ref=${ref.branch}`);
    return new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Nama berkas yang aman dan stabil dari judul projek. */
export function keSlug(judul: string) {
  return judul
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'projek';
}

/** YAML aman: apa pun dikutip supaya '#' dan ':' tidak merusak frontmatter. */
const kutip = (v: string) => JSON.stringify(v ?? '');

export function keMarkdown(p: {
  title: string;
  summary: string;
  stack: string[];
  year?: number;
  repo?: string;
  demo?: string;
  order: number;
  body: string;
}) {
  const baris = [
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
  ];
  return baris.join('\n');
}
