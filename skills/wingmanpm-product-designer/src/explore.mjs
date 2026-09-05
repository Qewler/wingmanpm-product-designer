import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectPath } from './evidence.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const text = (value, name, limit = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${name} must contain 1-${limit} characters.`);
  return value.trim();
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = (root, id) => {
  if (!safeId(id)) throw new Error('Exploration ID must use lowercase letters, numbers, and hyphens.');
  return path.join(root, '.wingmanpm-design', 'explorations', id);
};
async function atomic(file, data) {
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try { await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}

export function validateExploration(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !safeId(spec.id)) throw new Error('A valid exploration ID is required.');
  for (const field of ['target', 'question', 'identity', 'content']) text(spec[field], field);
  if (!Array.isArray(spec.options) || spec.options.length < 2 || spec.options.length > 6) throw new Error('Provide two to six options; two is the normal comparison size.');
  const ids = new Set();
  for (const option of spec.options) {
    if (!safeId(option.id) || ids.has(option.id)) throw new Error('Option IDs must be valid and unique.');
    ids.add(option.id);
    for (const field of ['title', 'idea', 'tradeoff', 'preview', 'difference', 'limits']) text(option[field], field);
    if (!/\.(?:html|png|webp|jpg)$/i.test(option.preview)) throw new Error('Preview must be a local HTML or image file.');
    if (option.mobile && !/\.(?:html|png|webp|jpg)$/i.test(option.mobile)) throw new Error('Mobile preview must be a local HTML or image file.');
  }
  if (!ids.has(spec.recommended)) throw new Error('Recommend one supplied option.');
  text(spec.reason, 'reason');
  if (new Set(spec.options.map(o => o.difference.trim().toLowerCase())).size !== ids.size) throw new Error('Describe a different structural or interaction choice for each option.');
  return spec;
}

export async function createExploration(root, spec) {
  validateExploration(spec);
  const prepared = [];
  for (const option of spec.options) {
    const assets = {};
    for (const field of ['preview', 'mobile']) {
      if (!option[field]) continue;
      const file = await projectPath(root, option[field]);
      if ((await stat(file)).size > 5 * 1024 * 1024) throw new Error('Each preview must be smaller than 5 MB.');
      const bytes = await readFile(file);
      const filename = `${option.id}-${field}${path.extname(file).toLowerCase()}`;
      assets[field] = { source: option[field], file: filename, hash: digest(bytes) };
      prepared.push({ filename, bytes });
    }
  }
  const options = spec.options.map(option => ({ ...option, assets: Object.fromEntries(['preview', 'mobile'].filter(field => option[field]).map(field => {
    const asset = prepared.find(item => item.filename.startsWith(`${option.id}-${field}.`));
    return [field, { source: option[field], file: asset.filename, hash: digest(asset.bytes) }];
  })) }));
  const session = { schemaVersion: 1, id: spec.id, target: spec.target, question: spec.question, identity: spec.identity, content: spec.content, options, recommended: spec.recommended, reason: spec.reason, stage: 'explore', selected: null, decision: null, revision: 0, createdAt: new Date().toISOString() };
  const directory = base(root, spec.id);
  await mkdir(path.dirname(directory), { recursive: true });
  await projectPath(root, '.wingmanpm-design/explorations');
  try { await mkdir(directory); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Exploration ${spec.id} already exists. Use a fresh ID to preserve its previews and choice.`);
    throw error;
  }
  try {
    for (const asset of prepared) await writeFile(path.join(directory, asset.filename), asset.bytes, { flag: 'wx' });
    await atomic(path.join(directory, 'session.json'), session);
    await writeFile(path.join(directory, 'board.html'), renderBoard(session));
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  return { id: spec.id, stage: session.stage, board: path.join(directory, 'board.html'), options: options.map(o => ({ id: o.id, title: o.title })), next: 'Serve this board for saved selection, or open board.html and use the chat fallback. Inspect all previews before asking the user to choose.' };
}

export async function inspectExploration(root, id) {
  const session = JSON.parse(await readFile(await projectPath(root, path.relative(root, path.join(base(root, id), 'session.json'))), 'utf8'));
  validateExploration(session);
  if (session.id !== id) throw new Error('Exploration ID does not match its folder.');
  for (const option of session.options) {
    if (!option.assets?.preview) throw new Error('Preview asset is missing.');
    for (const [kind, asset] of Object.entries(option.assets)) {
      if (!['preview', 'mobile'].includes(kind) || !new RegExp(`^${option.id}-${kind}\\.(html|png|webp|jpg)$`).test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.hash)) throw new Error('Invalid preview asset record.');
    }
  }
  const stale = [];
  for (const option of session.options) for (const asset of Object.values(option.assets)) {
    try {
      if (digest(await readFile(await projectPath(root, asset.source))) !== asset.hash) stale.push(asset.source);
      if (digest(await readFile(path.join(base(root, id), asset.file))) !== asset.hash) stale.push(asset.file);
    } catch { stale.push(asset.source); }
  }
  return { ...session, stale: [...new Set(stale)], releaseReady: false };
}

export async function chooseExploration(root, id, optionId, reason, revision) {
  const directory = base(root, id);
  const lock = path.join(directory, '.selection.lock');
  await writeFile(lock, '', { flag: 'wx' });
  try {
    const session = await inspectExploration(root, id);
    if (session.stale.length) throw new Error('Preview sources changed. Create a fresh exploration before choosing.');
    if (revision !== undefined && revision !== session.revision) throw new Error('This board is stale. Reload it before choosing.');
    if (!session.options.some(o => o.id === optionId)) throw new Error('Choose one of the supplied option IDs.');
    const { stale, releaseReady, ...saved } = session;
    Object.assign(saved, { selected: optionId, decision: text(reason, 'decision'), stage: 'selected', revision: session.revision + 1, selectedAt: new Date().toISOString() });
    await atomic(path.join(directory, 'session.json'), saved);
    return { id, selected: optionId, stage: 'selected', revision: saved.revision, next: 'Selection is saved locally. Read it with explore inspect before building; no agent has been notified automatically.' };
  } finally { await rm(lock, { force: true }); }
}

export function renderBoard(session, token = '') {
  const preview = (option, kind) => {
    const asset = option.assets[kind] ?? option.assets.preview;
    const file = escape(asset.file);
    return asset.file.endsWith('.html') ? `<iframe title="${escape(option.title)} ${kind}" src="${file}" sandbox="allow-scripts"></iframe>` : `<img alt="${escape(option.title)} ${kind}" src="${file}">`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(session.question)}</title><style>
  :root{color-scheme:light dark;--bg:#f5f6f8;--ink:#17232e;--muted:#52616d;--line:#cbd2d9;--panel:#fff;--accent:#205b9c}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:clamp(20px,4vw,64px)}h1{font-size:clamp(26px,3vw,42px);line-height:1.16;max-width:25ch;margin:0 0 20px}h2{font-size:22px;line-height:1.25;margin:0}p{max-width:75ch}.intro{color:var(--muted)}.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:30px 0 20px}.options{display:grid;grid-template-columns:repeat(${Math.min(3, session.options.length)},minmax(0,1fr));gap:24px}article{min-width:0}header{min-height:100px;padding:12px 0;border-top:1px solid var(--line)}.preview{background:var(--panel);border:1px solid var(--line);height:520px;overflow:auto;border-radius:12px}.preview iframe{border:0;width:1280px;height:860px;transform:scale(.48);transform-origin:top left}.preview img{display:block;width:100%;height:auto}.preview.mobile iframe{width:390px;transform:none;height:820px}.preview.mobile{max-width:392px;height:620px;margin-inline:auto}button,a{font:inherit}button,.open{display:inline-block;padding:10px 15px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);cursor:pointer;text-decoration:none}button[aria-pressed=true],.choose{background:var(--accent);border-color:var(--accent);color:#fff}button:focus-visible,a:focus-visible,textarea:focus-visible,.preview:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.details{padding:12px 0}.details p{margin:8px 0}.limits{color:var(--muted);font-size:14px}.recommendation{border-top:1px solid var(--line);margin-top:32px;padding-top:20px}.feedback{margin:24px 0;display:grid;gap:8px;max-width:740px}textarea{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;width:100%;min-height:90px}#status{min-height:48px;font-weight:600}small{color:var(--muted)}@media(max-width:900px){.options{grid-template-columns:1fr}.preview{height:440px}.preview iframe{transform:scale(.35)}}@media(prefers-color-scheme:dark){:root{--bg:#141c24;--ink:#edf2f7;--muted:#b0bdc9;--line:#45535f;--panel:#202c36;--accent:#235e9f}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style></head><body><main><h1>${escape(session.question)}</h1><p class="intro">Compare the same content in different directions. These are local concept previews, not a released product.</p><p><strong>Keep:</strong> ${escape(session.identity)}</p><p><strong>Content:</strong> ${escape(session.content)}</p><div class="toolbar" aria-label="Preview size"><button type="button" data-size="desktop" aria-pressed="true">Desktop</button><button type="button" data-size="mobile" aria-pressed="false">Mobile</button><small>Open a preview at full size to inspect detail and try its interactions.</small></div><div class="options">${session.options.map(option => `<article><header><h2>${escape(option.title)}</h2><p>${escape(option.idea)}</p></header><div class="preview" data-option="${escape(option.id)}" tabindex="0" role="region" aria-label="${escape(option.title)} preview">${preview(option, 'preview')}</div><div class="details"><p><strong>Different:</strong> ${escape(option.difference)}</p><p><strong>Tradeoff:</strong> ${escape(option.tradeoff)}</p><p class="limits">${escape(option.limits)}</p></div><a class="open" href="${escape(option.assets.preview.file)}" target="_blank" rel="noopener">Open full size</a> <button type="button" class="choose" data-choice="${escape(option.id)}">Choose ${escape(option.title)}</button></article>`).join('')}</div><div class="recommendation"><strong>Recommended: ${escape(session.options.find(o => o.id === session.recommended).title)}</strong><p>${escape(session.reason)}</p></div><div class="feedback"><label for="feedback">What should guide the next step?</label><textarea id="feedback" placeholder="Keep this structure, but make the main action easier to see.">${escape(session.decision ?? '')}</textarea></div><p id="status" role="status" aria-live="polite">${session.selected ? `Saved choice: ${escape(session.selected)}.` : token ? 'Choose a direction to save it locally.' : 'Static board: choosing prepares a message to paste into your agent chat.'}</p><div class="feedback" id="fallback" hidden><label for="message">Send this to your agent</label><textarea id="message" readonly></textarea></div></main><script>
  const session=${JSON.stringify({ id: session.id, revision: session.revision, options: session.options.map(o => ({ id: o.id, preview: o.assets.preview.file, mobile: o.assets.mobile?.file ?? o.assets.preview.file })) }).replace(/</g, '\\u003c')};const token=${JSON.stringify(token)};
  const fitPreviews=()=>document.querySelectorAll('.preview').forEach(panel=>{const frame=panel.querySelector('iframe');if(!frame)return;const mobile=panel.classList.contains('mobile');const scale=Math.min(1,panel.clientWidth/(mobile?390:1280));frame.style.transform='scale('+scale+')';panel.style.height=Math.min(mobile?620:520,(mobile?820:860)*scale)+'px';});
  const observer=new ResizeObserver(fitPreviews);document.querySelectorAll('.preview').forEach(panel=>observer.observe(panel));fitPreviews();
  document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-size]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.preview').forEach(panel=>{panel.classList.toggle('mobile',button.dataset.size==='mobile');const option=session.options.find(o=>o.id===panel.dataset.option);const media=panel.querySelector('iframe,img');const next=button.dataset.size==='mobile'?option.mobile:option.preview;if(media.getAttribute('src')!==next)media.src=next;});fitPreviews();}));
  document.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',async()=>{const reason=document.querySelector('#feedback').value.trim()||'User selected this direction from the comparison board.';const status=document.querySelector('#status');if(!token){document.querySelector('#fallback').hidden=false;document.querySelector('#message').value='Choose '+button.dataset.choice+' from exploration '+session.id+'. '+reason;status.textContent='Choice prepared. Paste the message into your agent chat to continue.';return;}button.disabled=true;try{const response=await fetch('/choice',{method:'POST',headers:{'Content-Type':'application/json','X-Wingman-Token':token},body:JSON.stringify({option:button.dataset.choice,reason,revision:session.revision})});const result=await response.json();if(!response.ok)throw new Error(result.error);session.revision=result.revision;status.textContent='Saved '+result.selected+' locally. Tell your agent to read exploration '+session.id+' and continue.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}}));
  </script></body></html>`;
}

export async function serveExploration(root, id, port = 0) {
  const session = await inspectExploration(root, id);
  if (session.stale.length) throw new Error('Preview sources changed; create a fresh exploration.');
  const token = randomBytes(24).toString('hex');
  const assets = new Map(session.options.flatMap(option => Object.values(option.assets).map(asset => ['/' + asset.file, asset])));
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
      if (req.method === 'POST' && req.url === '/choice') {
        if (req.headers.origin !== origin || req.headers['x-wingman-token'] !== token) { res.writeHead(403).end(); return; }
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8192) throw new Error('Selection is too large.'); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const result = await chooseExploration(root, id, body.option, body.reason, body.revision);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
      }
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      if (req.url === '/' || req.url === '/board.html') {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderBoard(await inspectExploration(root, id), token)); return;
      }
      const asset = assets.get(req.url);
      if (!asset) { res.writeHead(404).end(); return; }
      const bytes = await readFile(path.join(base(root, id), asset.file));
      if (digest(bytes) !== asset.hash) throw new Error('Preview changed.');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; connect-src 'none'; base-uri 'none'; sandbox allow-scripts");
      res.setHeader('Content-Type', asset.file.endsWith('.html') ? 'text/html; charset=utf-8' : `image/${path.extname(asset.file).slice(1).replace('jpg', 'jpeg')}`);
      res.end(bytes);
    } catch (error) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, id };
}
