// 구글 문서(Google Docs) → data/content.json
// GitHub Actions에서 실행됩니다. 로컬 테스트: node scripts/fetch-docs.mjs [문서.html]
// 구글 문서는 "링크가 있는 모든 사용자 - 뷰어"로 공유되어 있어야 합니다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const OUT_JSON = path.join(ROOT, 'data', 'content.json');
const IMG_DIR = path.join(ROOT, 'assets', 'posts');
const FAC_DIR = path.join(ROOT, 'assets', 'faculty');

function docIdOf(v) {
  if (!v) return '';
  const m = String(v).match(/\/document\/d\/([A-Za-z0-9_-]{20,})/);
  if (m && m[1] !== 'e') return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(v)) return v;
  return '';
}

async function loadHtml() {
  const local = process.argv[2];
  if (local) return fs.readFileSync(local, 'utf8');
  const src = (cfg.googleDoc || '').trim();
  if (!src || src.includes('여기에')) { console.log('site.config.json에 googleDoc이 설정되지 않아 기존 content.json을 유지합니다.'); return null; }
  let url;
  if (/\/document\/d\/e\/.+\/pub/.test(src)) url = src;                       // 웹에 게시 주소
  else { const id = docIdOf(src); if (!id) throw new Error('googleDoc 값을 이해할 수 없습니다: ' + src); url = `https://docs.google.com/document/d/${id}/export?format=html`; }
  const r = await fetch(url, { redirect: 'follow' });
  const t = await r.text();
  if (!r.ok || /accounts\.google\.com|ServiceLogin/.test(r.url) || /<title>[^<]*(Sign in|로그인)/i.test(t))
    throw new Error(`구글 문서를 읽을 수 없습니다 (HTTP ${r.status}). 문서를 "링크가 있는 모든 사용자 - 뷰어"로 공유했는지 확인하세요.`);
  return t;
}

// ---------- HTML → blocks ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}
const escHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function realHref(h) {
  h = decode(h);
  const m = h.match(/^https?:\/\/www\.google\.com\/url\?q=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : h;
}
function blocksOf(html) {
  let body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  // published docs wrap content in #contents
  const c = body.match(/<div id="contents"[^>]*>([\s\S]*)<\/div>\s*(?:<div id="footer"|$)/i); if (c) body = c[1];
  const out = [];
  const re = /<(p|h[1-6]|li|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\b[^>]*\/?>/gi;
  let m;
  while ((m = re.exec(body))) {
    if (!m[1] || m[1].toLowerCase() === 'hr') { out.push({ tag: 'hr', text: '---', html: '', imgs: [] }); continue; }
    const inner = m[2];
    const imgs = [...inner.matchAll(/<img\b[^>]*src="([^"]+)"/gi)].map(x => decode(x[1]));
    const links = [];
    let tmp = inner.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => { links.push([realHref(h), decode(t.replace(/<[^>]+>/g, ''))]); return `\u0000${links.length - 1}\u0000`; });
    tmp = tmp.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const text = decode(tmp).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i][1]).replace(/ /g, ' ').trim();
    let h = escHtml(decode(tmp)).replace(/\u0000(\d+)\u0000/g, (_, i) => `<a href="${escHtml(links[i][0])}" target="_blank" rel="noopener">${escHtml(links[i][1])}</a>`).replace(/ /g, ' ').trim().replace(/\n/g, '<br>');
    out.push({ tag: m[1].toLowerCase(), text, html: h, imgs, links });
  }
  return out;
}

// ---------- blocks → content ----------
const SEC = [
  [/^(설정|settings?)$/i, 'settings'],
  [/^(공지|공지사항|notice|notices)$/i, 'notice'],
  [/^(뉴스|소식|news)$/i, 'news'],
  [/^(교수\s*사진|교수진\s*사진|faculty\s*photos?)$/i, 'faculty'],
];
const FIELD = {
  '날짜': 'date', 'date': 'date', '제목': 'title', 'title': 'title', '영문제목': 'title_en', '제목(영문)': 'title_en', '영문 제목': 'title_en',
  '카테고리': 'category', '분류': 'category', 'category': 'category', '링크': 'link', 'link': 'link', '이미지': 'image', '대표이미지': 'image', '대표 이미지': 'image', 'image': 'image',
  '고정': 'pinned', '상단고정': 'pinned', '요약': 'summary', '공개': 'visible', '게시': 'visible',
};
function sectionOf(text) {
  const t = text.replace(/^[=#\s\[【]+|[=#\s\]】]+$/g, '').trim();
  for (const [re, k] of SEC) if (re.test(t)) return k;
  return null;
}
function isSectionLine(b) {
  const raw = b.text.trim();
  if (/^={2,}.*={2,}$/.test(raw) || /^\[.*\]$/.test(raw) || /^【.*】$/.test(raw) || /^h[1-3]$/.test(b.tag) || /^#/.test(raw)) return sectionOf(raw);
  return null;
}
const isSep = b => b.tag === 'hr' || /^[-–—_=*~]+$/.test(b.text.trim());
function normDate(v) {
  const m = String(v || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}
function driveDirect(u) {
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{10,})/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u;
}
function parse(blocks) {
  const res = { settings: {}, notice: [], news: [], faculty: {} };
  let sec = null, post = null, inBody = false, pendingFac = null;
  const flush = () => {
    if (post && sec && (post.title || post.body.length)) res[sec].push(post);
    post = null; inBody = false;
  };
  for (const b of blocks) {
    const s = isSectionLine(b);
    if (s) { flush(); sec = s; pendingFac = null; continue; }
    if (!sec) continue;
    const text = b.text;
    if (/^※/.test(text.trim())) continue;                        // 안내문
    if (sec === 'settings') {
      const m = text.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (m) res.settings[m[1].trim()] = (b.links && b.links[0] ? b.links[0][0] : m[2].trim());
      continue;
    }
    if (sec === 'faculty') {
      const m = text.match(/^([가-힣A-Za-z\s]{2,20}?)\s*(?:교수)?\s*[:：]\s*(.*)$/);
      if (m) { pendingFac = m[1].trim(); const url = (b.links && b.links[0] && b.links[0][0]) || m[2].trim(); if (/^https?:/.test(url)) { res.faculty[pendingFac] = url; pendingFac = null; } }
      if (b.imgs.length && pendingFac) { res.faculty[pendingFac] = b.imgs[0]; pendingFac = null; }
      continue;
    }
    // notice / news
    if (isSep(b)) { flush(); continue; }
    if (!post) post = { title: '', title_en: '', date: '', category: '', link: '', image: '', summary: '', pinned: false, visible: true, body: [] };
    const fm = !inBody && text.match(/^([^:：]{1,8})[:：]\s*(.*)$/);
    if (fm && /^본문$|^내용$|^body$/i.test(fm[1].trim())) { inBody = true; if (fm[2].trim()) post.body.push({ type: 'p', html: escHtml(fm[2].trim()) }); b.imgs.forEach(src => post.body.push({ type: 'img', src })); continue; }
    if (fm && FIELD[fm[1].trim()] && !inBody) {
      const k = FIELD[fm[1].trim()]; let v = fm[2].trim();
      if (k === 'link' || k === 'image') v = (b.links && b.links[0] && b.links[0][0]) || v;
      if (k === 'image' && !v && b.imgs.length) v = b.imgs[0];
      if (k === 'pinned') post.pinned = /^(y|yes|o|예|네|true|1|고정)/i.test(v);
      else if (k === 'visible') post.visible = !/^(n|no|x|아니오|아니요|false|0|숨김|비공개)/i.test(v);
      else post[k] = v;
      continue;
    }
    if (!inBody && b.imgs.length && !text) { if (!post.image) post.image = b.imgs[0]; continue; }
    // anything else is body
    inBody = true;
    if (text) post.body.push({ type: 'p', html: b.html });
    b.imgs.forEach(src => post.body.push({ type: 'img', src }));
  }
  flush();
  return res;
}

// ---------- images ----------
async function download(url, dir, base) {
  const src = driveDirect(url);
  try {
    const r = await fetch(src, { redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || !ct.startsWith('image/')) { console.warn('이미지 다운로드 실패:', url, r.status, ct); return null; }
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[ct.split(';')[0]] || 'jpg';
    const buf = Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(dir, { recursive: true });
    const name = `${base}.${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  } catch (e) { console.warn('이미지 다운로드 오류:', url, e.message); return null; }
}
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

async function main() {
  const html = await loadHtml();
  if (html == null) return;
  const data = parse(blocksOf(html));
  const offline = !!process.argv[2];
  for (const kind of ['notice', 'news']) {
    const list = data[kind].filter(p => p.visible !== false && p.title);
    const used = new Set();
    for (const p of list) {
      p.date = normDate(p.date);
      p.date_disp = p.date ? p.date.replace(/-/g, '.') : '';
      let id = (p.date || 'post').replace(/-/g, '') + '-' + hash(p.title).slice(0, 6);
      while (used.has(id)) id += 'x'; used.add(id); p.id = id;
      if (!offline) {
        if (p.image && /^https?:/.test(p.image)) { const n = await download(p.image, IMG_DIR, hash(p.image)); p.image = n ? `assets/posts/${n}` : (p.image.includes('drive.google.com') ? '' : p.image); }
        for (const b of p.body) if (b.type === 'img' && /^https?:/.test(b.src)) { const n = await download(b.src, IMG_DIR, hash(b.src)); if (n) b.src = `assets/posts/${n}`; }
      }
      if (!p.image) { const f = p.body.find(b => b.type === 'img'); if (f) p.image = f.src; }
      p.text = p.body.filter(b => b.type === 'p').map(b => b.html.replace(/<[^>]+>/g, '')).join(' ').slice(0, 400);
      delete p.visible;
    }
    list.sort((a, b) => (b.pinned - a.pinned) || (b.date || '').localeCompare(a.date || ''));
    data[kind] = list;
  }
  if (!offline) {
    for (const [name, url] of Object.entries(data.faculty)) {
      const n = await download(url, FAC_DIR, 'f-' + hash(name));
      if (n) data.faculty[name] = `assets/faculty/${n}`; else delete data.faculty[name];
    }
  }
  // 저장소에 직접 올린 교수 사진(assets/faculty/이름.jpg)도 반영
  if (fs.existsSync(FAC_DIR)) for (const f of fs.readdirSync(FAC_DIR)) {
    const m = f.match(/^([가-힣]{2,5})\.(jpe?g|png|webp)$/i);
    if (m && !data.faculty[m[1]]) data.faculty[m[1]] = `assets/faculty/${f}`;
  }
  data.updated = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 1));
  console.log(`완료: 공지 ${data.notice.length}건 · 뉴스 ${data.news.length}건 · 설정 ${Object.keys(data.settings).length}개 · 교수사진 ${Object.keys(data.faculty).length}명`);
}
main().catch(e => { console.error('오류:', e.message); process.exit(1); });
