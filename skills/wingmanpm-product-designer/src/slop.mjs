// Rendered anti-slop gates. collectSlopDOM and probeMenus are self-contained so
// any host browser (Playwright, CDP, agent-browser `eval`) can run them verbatim.

export const SLOP_LIMITS = {
  persuade: { h1Min: 1, h1Max: 1, maxHeadingLevel: 3, heroWords: 35, bodyWords: 450, h2PerSection: 1, headingsTotal: 16, cardLines: 3, prose: Infinity, firstViewHeadings: Infinity },
  operate: { h1Min: 0, h1Max: 1, maxHeadingLevel: 4, heroWords: Infinity, bodyWords: Infinity, h2PerSection: Infinity, headingsTotal: Infinity, cardLines: 3, prose: 150, firstViewHeadings: 8 },
  read: { h1Min: 1, h1Max: 1, maxHeadingLevel: 4, heroWords: Infinity, bodyWords: Infinity, h2PerSection: Infinity, headingsTotal: Infinity, cardLines: Infinity, prose: Infinity, firstViewHeadings: Infinity }
};

export const SLOP_TYPE = { characterUses: 3, ctaGapMin: 200, ctaGapRatio: 2, groundL: 0.9, groundC: 0.02, viewportFamilies: 3 };

export function collectSlopDOM() {
  const W = innerWidth, H = innerHeight;
  const DEMO = 'figure,[data-demo],[data-product-demo],[role="img"],[aria-hidden="true"],svg,pre,code,kbd,samp,dialog:not([open]),[inert]';
  const CHROME = 'nav,[role="navigation"],footer,[role="contentinfo"],header:has(nav),[role="banner"]';
  const visible = el => {
    if (!el || el.closest('[hidden],[inert]')) return false;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden' || Number(ps.opacity) < 0.02) return false; }
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const words = t => (String(t).match(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu) || []).length;
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const fullText = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const px = v => parseFloat(v) || 0;
  const label = el => (el.getAttribute('aria-label') || fullText(el) || el.getAttribute('placeholder') || el.getAttribute('title') || el.tagName.toLowerCase()).slice(0, 60);
  const scrollY0 = scrollY; scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // Stylesheet index for state rules.
  const stateRules = { hover: [], focus: [], disabled: [], selection: false };
  const walk = rules => { for (const rule of rules) {
    if (rule.cssRules && !rule.selectorText) { try { walk(rule.cssRules); } catch {} continue; }
    const sel = rule.selectorText; if (!sel) continue;
    for (const part of sel.split(',')) {
      if (/::selection/.test(part)) stateRules.selection = true;
      const strip = re => part.replace(re, '').replace(/:(is|where)\(\s*\)/g, '').trim() || '*';
      if (/:hover/.test(part)) stateRules.hover.push(strip(/:hover/g));
      if (/:focus(-visible|-within)?/.test(part)) stateRules.focus.push(strip(/:focus(-visible|-within)?/g));
      if (/:disabled|\[disabled\]|\[aria-disabled/.test(part)) stateRules.disabled.push(strip(/:disabled|\[disabled\]|\[aria-disabled(="true")?\]/g));
    }
  } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
  const matchesAny = (el, list) => list.some(sel => { try { return el.matches(sel); } catch { return false; } });
  const ancestorsMatch = (el, list) => { for (let p = el, i = 0; p && i < 3; p = p.parentElement, i++) if (matchesAny(p, list)) return true; return false; };

  // Headings.
  const headingEls = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(el => visible(el) && !el.closest(DEMO) && !el.closest('footer,[role="contentinfo"],nav,[role="navigation"]'));
  const levelOf = el => /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : Number(el.getAttribute('aria-level')) || 2;
  const sectionOf = el => { const s = el.closest('section,article,[role="region"]'); if (s) { let top = s; for (let p = s.parentElement; p; p = p.parentElement) if (p.matches('section,[role="region"]')) top = p; return top; } const main = el.closest('main') || document.body; let c = el; while (c.parentElement && c.parentElement !== main) c = c.parentElement; return c; };
  const sections = new Map();
  const firstMeaningful = start => { for (let n = start; n; n = n.nextElementSibling) { if (!visible(n) || !fullText(n)) continue; return n; } return null; };
  const isHeadingish = el => el && (el.matches('h1,h2,h3,h4,h5,h6,[role="heading"]') || (el.firstElementChild && el.firstElementChild.matches('h1,h2,h3,h4,h5,h6') && fullText(el.firstElementChild) === fullText(el)));
  const looksEyebrow = el => {
    if (!el || !visible(el) || el.matches('h1,h2,h3,h4,h5,h6,a,button,time,input,label,img,svg,ul,ol')) return false;
    const t = fullText(el); if (!t || words(t) > 5 || t.length > 40) return false;
    const s = getComputedStyle(el), size = px(s.fontSize), track = px(s.letterSpacing) / size;
    const caps = s.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]{3}/.test(t));
    return size <= 14.5 && (caps || track >= 0.06);
  };
  const headings = headingEls.map((el, i) => {
    const level = levelOf(el), r = el.getBoundingClientRect(), sec = sectionOf(el);
    if (!sections.has(sec)) sections.set(sec, { h2: 0, headings: 0, h2Text: [] }); const rec = sections.get(sec); rec.headings++; if (level === 2) { rec.h2++; rec.h2Text.push(fullText(el).slice(0, 40)); }
    const next = firstMeaningful(el.nextElementSibling) || (el.parentElement && !el.nextElementSibling ? firstMeaningful(el.parentElement.nextElementSibling) : null);
    const stacked = isHeadingish(next) && levelOf(next.matches('h1,h2,h3,h4,h5,h6,[role="heading"]') ? next : next.firstElementChild) > level;
    let prev = el.previousElementSibling; while (prev && !visible(prev)) prev = prev.previousElementSibling;
    if (!prev && el.parentElement && el.parentElement.firstElementChild === el) { prev = el.parentElement.previousElementSibling; while (prev && !visible(prev)) prev = prev.previousElementSibling; }
    return { level, text: fullText(el).slice(0, 80), top: Math.round(r.top + scrollY), firstView: r.top < H, stacked, eyebrow: looksEyebrow(prev) ? fullText(prev).slice(0, 40) : null };
  });
  const sectionStats = [...sections.values()];

  // Copy budgets.
  const textNodes = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const p = n.parentElement; if (!p || !n.textContent.trim() || p.closest('script,style,noscript,' + DEMO + ',' + CHROME + ',[role="menu"],[role="listbox"],[role="dialog"],dialog,table,[role="table"],[role="grid"]')) continue; textNodes.push(n); }
  const frameCache = new Map();
  const inFrame = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { if (frameCache.has(p)) return frameCache.get(p); const s = getComputedStyle(p), r = p.getBoundingClientRect(); const framed = r.width >= 280 && px(s.borderTopLeftRadius) >= 6 && ((px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || s.boxShadow !== 'none'); if (framed) { frameCache.set(p, true); return true; } } return false; };
  let heroWords = 0; const heroSample = [];
  for (const n of textNodes) { const p = n.parentElement; if (!visible(p)) continue; const r = p.getBoundingClientRect(); if (r.top >= H || r.bottom <= 0) continue; if (px(getComputedStyle(p).fontSize) < 15 || inFrame(p)) continue; heroWords += words(n.textContent); if (heroSample.join(' ').length < 160) heroSample.push(n.textContent.trim()); }
  const proseEls = [...document.querySelectorAll('p,li,dd,blockquote')].filter(el => visible(el) && !el.closest(DEMO + ',' + CHROME + ',table,[role="table"],[role="grid"],[role="menu"],[role="listbox"],dialog,[role="dialog"]') && !el.querySelector('p,li') && px(getComputedStyle(el).fontSize) >= 14);
  const bodyWords = proseEls.reduce((sum, el) => sum + words(fullText(el)), 0);
  const repeated = el => { for (let p = el.parentElement, i = 0; p && i < 5; p = p.parentElement, i++) { const sibs = p.parentElement ? [...p.parentElement.children].filter(s => s.tagName === p.tagName && s.className === p.className) : []; if (sibs.length >= 3) return true; if (p.matches('li,tr,[role="row"],[role="listitem"],[role="option"]')) return true; } return false; };
  const operateProse = [...document.querySelectorAll('p')].filter(el => visible(el) && !el.closest(DEMO + ',table,[role="grid"],dialog,[role="dialog"],[role="menu"],[role="listbox"]') && !repeated(el)).reduce((sum, el) => sum + words(fullText(el)), 0);

  // Long paragraphs inside cards.
  const bgOf = el => { for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p).backgroundColor; if (c && !/rgba?\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
  const cardOf = el => { for (let p = el.parentElement, i = 0; p && i < 5 && p !== document.body; p = p.parentElement, i++) { const s = getComputedStyle(p), r = p.getBoundingClientRect(); if (r.width > W * 0.7) return null; const framed = (px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || s.boxShadow !== 'none' || (p.parentElement && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== bgOf(p.parentElement)); if (framed && px(s.borderTopLeftRadius) >= 4) return p; } return null; };
  const longCardText = [];
  const inlineOnly = el => [...el.children].every(c => c.matches('br') || /^inline/.test(getComputedStyle(c).display) && !/flex|grid|block/.test(getComputedStyle(c).display));
  for (const el of document.querySelectorAll('p,li,dd')) {
    if (!visible(el) || el.closest(DEMO + ',dialog,[role="dialog"],table') || !inlineOnly(el)) continue; const card = cardOf(el); if (!card) continue;
    const s = getComputedStyle(el), lh = s.lineHeight === 'normal' ? px(s.fontSize) * 1.2 : px(s.lineHeight); const lines = Math.round(el.getBoundingClientRect().height / lh);
    if (lines > 3) longCardText.push({ lines, sample: fullText(el).slice(0, 70) });
  }

  // Controls and row alignment.
  const ctrlSel = 'button,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]):not([type="file"]):not([type="color"]),select,[role="button"],[role="combobox"],a';
  const isBoxed = el => { const s = getComputedStyle(el); return (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || (px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || el.matches('input,select'); };
  const boxOf = el => { if (!el.matches('input,select')) return el; const p = el.parentElement; if (!p || p.matches('body,form,main,section')) return el; const ps = getComputedStyle(p), pr = p.getBoundingClientRect(), r = el.getBoundingClientRect(); const framed = (px(ps.borderTopWidth) > 0 && ps.borderTopStyle !== 'none') || ps.boxShadow !== 'none' || (ps.backgroundColor !== 'rgba(0, 0, 0, 0)' && ps.backgroundColor !== 'transparent'); const s = getComputedStyle(el); const bare = px(s.borderTopWidth) === 0 || s.borderTopStyle === 'none'; return framed && bare && pr.height >= r.height && pr.height - r.height <= 12 && pr.width >= r.width ? p : el; };
  const controls = [...new Set([...document.querySelectorAll(ctrlSel)].map(boxOf))].filter(el => visible(el) && !el.closest(DEMO + ',[role="menu"],[role="listbox"],[role="switch"]') && (!el.matches('a') || (isBoxed(el) && px(getComputedStyle(el).paddingLeft) >= 8)) && el.getBoundingClientRect().height >= 24 && el.getBoundingClientRect().height <= 64);
  const rowParent = el => { for (let p = el.parentElement, i = 0; p && i < 4; p = p.parentElement, i++) { const s = getComputedStyle(p); if ((/flex/.test(s.display) && !/column/.test(s.flexDirection)) || /grid/.test(s.display)) return p; } return null; };
  const groups = new Map();
  for (const el of controls) { const p = rowParent(el); if (!p) continue; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(el); }
  const misaligned = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].getBoundingClientRect(), b = list[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0) continue; // overlapping or stacked horizontally: not row neighbours
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (overlap < Math.min(a.height, b.height) * 0.5) continue;
      const dh = Math.abs(a.height - b.height), dc = Math.abs((a.top + a.height / 2) - (b.top + b.height / 2));
      if (dh > 1.01 || dc > 1.01) { misaligned.push({ a: label(list[i]), b: label(list[j]), heights: [Math.round(a.height * 10) / 10, Math.round(b.height * 10) / 10], centerOffset: Math.round(dc * 10) / 10 }); i = list.length; break; }
    }
  }
  const textControls = controls.filter(el => fullText(el) || el.matches('input,select'));
  const controlHeights = [...new Set(textControls.map(el => Math.round(el.getBoundingClientRect().height)))].sort((x, y) => x - y);

  const nativeSelects = [...document.querySelectorAll('select')].filter(el => visible(el) && !el.closest(DEMO) && !/none/.test(getComputedStyle(el).appearance)).map(label);
  const checks = [...document.querySelectorAll('input[type="checkbox"],input[type="radio"]')].filter(el => visible(el) && !el.closest(DEMO));
  const unthemedChecks = checks.filter(el => { const s = getComputedStyle(el); return !/none/.test(s.appearance) && s.accentColor === 'auto'; }).length;
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < W && r.bottom + scrollY > 0 && !(r.width <= 2 && r.height <= 2); };
  const buttonLike = [...document.querySelectorAll('button,[role="button"],a,[role="menuitem"],[role="option"],[role="tab"],summary')].filter(el => visible(el) && onScreen(el) && !el.closest(DEMO) && (!el.matches('a') || isBoxed(el)));
  const noHover = buttonLike.filter(el => !el.disabled && !ancestorsMatch(el, stateRules.hover)).map(label);
  const noFocus = [...document.querySelectorAll('button,[role="button"],a[href],input,select,textarea,[role="combobox"],[role="tab"],[tabindex]:not([tabindex="-1"])')].filter(el => visible(el) && !el.closest(DEMO) && !ancestorsMatch(el, stateRules.focus) && !stateRules.focus.includes('*')).map(label);
  const disabledEls = [...document.querySelectorAll(':disabled,[aria-disabled="true"]')].filter(el => visible(el) && !el.closest(DEMO));
  const noDisabled = disabledEls.filter(el => !ancestorsMatch(el, stateRules.disabled)).map(label);
  const chevronTriggers = [...document.querySelectorAll('button,[role="button"]')].filter(el => visible(el) && !el.closest(DEMO) && !el.hasAttribute('aria-haspopup') && !el.hasAttribute('aria-expanded') && el.getAttribute('tabindex') !== '-1' && !el.parentElement?.querySelector('[role="combobox"]') && el.querySelector('[class*="chevron-down"],[class*="chevrons-up-down"],[class*="caret-down"],[class*="selector"],[data-lucide="chevron-down"],[data-lucide="chevrons-up-down"],[data-icon*="chevron-down"],[class~="chev"],[class~="caret"]')).map(label);

  // Mobile and clipping: small targets, clipped controls, truncated text.
  const interactive = [...document.querySelectorAll('button,[role="button"],input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,[role="combobox"],[role="tab"],a.btn,a[class*="button"]')].filter(el => visible(el) && !el.closest('[aria-hidden="true"],[inert],[role="menu"],[role="listbox"]'));
  const smallTargets = W <= 480 ? [...new Set(interactive.map(boxOf))].filter(el => { const r = el.getBoundingClientRect(); return r.height < 32 && r.width >= 24 && (fullText(el).length > 1 || el.matches('input,select,[role="combobox"]')); }).map(el => `${label(el)} (${Math.round(el.getBoundingClientRect().height)}px)`) : [];
  const clipper = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(hidden|clip)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflow)) return p; if (/(auto|scroll)/.test(s.overflowX)) return null; } return null; };
  const clipped = interactive.filter(el => { const r = el.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return false; if (r.right > W + 1 && !el.closest('[style*="overflow"],[class*="scroll"]')) { for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return false; return true; } const c = clipper(el); if (!c) return false; const cr = c.getBoundingClientRect(); return r.right > cr.right + 1 || r.left < cr.left - 1; }).map(label);
  // Text in the first viewport hidden under a fixed or sticky bar it does not belong to.
  const modalOpen = [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].some(el => visible(el));
  const covered = modalOpen ? [] : [...document.querySelectorAll('h1, h2, h3, p, a, button, label')].filter(el => { if (!visible(el) || !ownText(el)) return false; const r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= H || r.width < 8) return false; const y = r.top + Math.min(4, r.height / 3); return [r.left + 4, (r.left + r.right) / 2, r.right - 4].some(x => { if (x < 0 || x > W) return false; const hit = document.elementFromPoint(x, y); if (!hit || el.contains(hit) || hit.contains(el)) return false; for (let p = hit; p && p !== document.body; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') return !p.contains(el); } return false; }); }).map(el => fullText(el).slice(0, 40));
  const topBar = [...document.querySelectorAll('body *')].find(el => { const s = getComputedStyle(el); if (s.position !== 'fixed' && s.position !== 'sticky') return false; const r = el.getBoundingClientRect(); return r.top <= 1 && r.height > 24 && r.height < H * 0.25 && r.width > W * 0.6; });
  const firstH1 = document.querySelector('h1');
  const heroGap = topBar && firstH1 && visible(firstH1) ? (() => { const hr = firstH1.getBoundingClientRect(), br = topBar.getBoundingClientRect(); return hr.top < H && hr.top >= br.bottom - 1 ? { gap: Math.round(hr.top - br.bottom), size: Math.round(parseFloat(getComputedStyle(firstH1).fontSize)) } : null; })() : null;
  // Content marked [hidden] that CSS forces back on screen (display rules beating the attribute).
  // Includes content inside dialogs, popovers, and menus that are closed at load: judges open them.
  const closedHost = p => p.matches('dialog:not([open]),[popover],[role="dialog"],[aria-modal="true"],[role="menu"],[role="listbox"]');
  const hiddenShown = [...document.querySelectorAll('[hidden]')].filter(el => { if (getComputedStyle(el).display === 'none' || el.closest('template')) return false; let inClosed = false; for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden') { if (closedHost(p) && !p.hasAttribute('hidden')) { inClosed = true; continue; } return false; } } if (inClosed) return Boolean(ownText(el) || el.querySelector('*')); const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; return getComputedStyle(el).visibility !== 'hidden'; }).map(el => label(el));
  // Text cut by the viewport edge itself: a board or table bleeding off the page with its labels.
  const scrollsX = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { const pr = p.getBoundingClientRect(); return pr.right <= W + 1 && pr.left >= -1; } return false; };
  const edgeCut = [...document.querySelectorAll('body *')].filter(el => { if (!ownText(el) || ownText(el).length < 2 || !visible(el) || el.closest('[aria-hidden="true"],[role="marquee"],marquee')) return false; const r = el.getBoundingClientRect(); const cut = (r.left < W - 4 && r.right > W + 2) || (r.left < -2 && r.right > 4); return cut && r.height < H && !scrollsX(el); }).map(el => ownText(el).slice(0, 30));
  // On desktop, a sideways scroller that runs off the page edge reads as a cropped board.
  if (W > 480) for (const el of document.querySelectorAll('body *')) { const st = getComputedStyle(el); if (!/(auto|scroll)/.test(st.overflowX) || el.scrollWidth <= el.clientWidth + 8 || !visible(el) || el.closest('[aria-hidden="true"]')) continue; const r = el.getBoundingClientRect(); if (r.right >= W - 2 && r.left > 8 && fullText(el).length > 2) edgeCut.push(`scroller: ${fullText(el).slice(0, 24)}`); }
  // Text cut off by overflow without an ellipsis, demo content included.
  const clippedText = [...document.querySelectorAll('body *')].filter(el => { if (!visible(el) || !ownText(el) || el.closest('[aria-hidden="true"],pre,code,textarea,input')) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); if (r.width <= 4 || r.height <= 4 || s.clip !== 'auto' || (s.clipPath && s.clipPath !== 'none')) return false; return /(hidden|clip)/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && s.whiteSpace !== 'normal' && el.scrollWidth > el.clientWidth + 2; }).map(el => fullText(el).slice(0, 30));
  // Controls whose label nearly disappears into their own or inherited background.
  const rgba = v => { const m = String(v).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = c => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const backdrop = el => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const ancestors = () => { const a = []; for (let p = el; p; p = p.parentElement) a.push(p); return a; }; const onScreen = x >= 0 && y >= 0 && x <= W && y <= H; const stack = onScreen ? document.elementsFromPoint(x, y) : ancestors(); const start = stack.indexOf(el) === -1 ? stack.findIndex(n => el.contains(n)) : stack.indexOf(el); if (start === -1) return null; const layers = []; for (const p of stack.slice(start)) { const s = getComputedStyle(p); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = rgba(s.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } } let base = [255, 255, 255]; for (const c of layers.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return base; };
  const faintControls = [...document.querySelectorAll('button, [role="button"], a[class*="btn"], a[class*="button"]')].filter(el => { if (!visible(el) || !fullText(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false; const fg = rgba(getComputedStyle(el).color), bg = backdrop(el); if (!fg || !bg) return false; const f = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])); return ratio(f, bg) < 3; }).map(label);
  const truncated = [...document.querySelectorAll('body *')].filter(el => { if (!visible(el) || el.closest('[aria-hidden="true"]') || !ownText(el)) return false; const s = getComputedStyle(el); return s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1; }).map(el => fullText(el).slice(0, 40));

  // Type and hierarchy: who is largest in the fold, which families do which jobs, where the primary action sits.
  const familyOf = s => (s.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim();
  const MONO = /mono|courier|consolas|menlo|monaco|plex mono|code|monospace/i, ICONS = /icon|symbol|awesome|glyph/i;
  const CHARACTER = /doto|silkscreen|pixel|press start|vt323|jersey|tiny5|micro 5|sixtyfour|handjet|dotgothic|courier|stencil|monoton|bungee|workbench|nabla|rubik (glitch|mono one)|major mono|share tech|orbitron|syne mono/i;
  const h1Vis = firstH1 && visible(firstH1) ? firstH1 : null;
  const h1Px = h1Vis ? px(getComputedStyle(h1Vis).fontSize) : 0;
  const h1Family = h1Vis ? familyOf(getComputedStyle(h1Vis)) : '';
  const typeEls = [...document.querySelectorAll('body *')].filter(el => ownText(el).replace(/[\s·•|/–—-]/g, '').length > 1 && visible(el) && !el.closest('script,style,noscript,[aria-hidden="true"],svg'));
  const famChars = {}; const fvLarge = new Set(); const fvFamilies = new Set(); const outsized = []; const characterUse = []; let proseChars = 0, monoProse = 0;
  for (const el of typeEls) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), fam = familyOf(s), size = px(s.fontSize), n = ownText(el).length;
    if (!fam || ICONS.test(fam)) continue;
    const inH1 = Boolean(h1Vis && h1Vis.contains(el)), demo = Boolean(el.closest('figure,[data-demo],[data-product-demo]')), chrome = Boolean(el.closest(CHROME));
    famChars[fam] = (famChars[fam] || 0) + n;
    const firstView = r.top < H && r.bottom > 0;
    if (firstView && size >= 40) fvLarge.add(fam);
    if (firstView && !chrome) fvFamilies.add(fam);
    if (firstView && !inH1 && h1Px && size > h1Px + 0.5) outsized.push({ text: ownText(el).slice(0, 30), size: Math.round(size) });
    if (!inH1 && !demo && !chrome && fam === h1Family && CHARACTER.test(fam)) characterUse.push(`${el.tagName.toLowerCase()} ${ownText(el).slice(0, 30)}`);
    if (!demo && !chrome && el.matches('p,li,dd,blockquote') && !el.closest('pre,code,table')) { proseChars += n; if (MONO.test(s.fontFamily)) monoProse += n; }
  }
  const totalChars = Object.values(famChars).reduce((a, b) => a + b, 0) || 1;
  const families = Object.entries(famChars).filter(([f, c]) => c / totalChars >= 0.02 || f === h1Family).sort((a, b) => b[1] - a[1]).map(([f, c]) => ({ family: f, share: Math.round(c / totalChars * 100) }));
  const skipLink = el => /skip/i.test(fullText(el)) && /^#/.test(el.getAttribute('href') || ''); const offscreen = el => { const r = el.getBoundingClientRect(); return r.bottom <= 0 || r.right <= 0 || r.left >= W; };
  const isPrimary = el => { if (skipLink(el) || offscreen(el)) return false; const s = getComputedStyle(el); const c = rgba(s.backgroundColor); return c && c[3] > 0.6 && !el.closest(CHROME + ',figure,[data-demo],[data-product-demo],dialog,[role="dialog"]'); };
  const primary = h1Vis ? [...document.querySelectorAll('a,button')].find(el => visible(el) && fullText(el) && isPrimary(el) && el.getBoundingClientRect().top < H * 1.2) : null;
  const ctaGap = primary ? (() => { const a = primary.getBoundingClientRect(), h = h1Vis.getBoundingClientRect(); const dx = Math.max(0, a.left - h.right, h.left - a.right), dy = Math.max(0, a.top - h.bottom, h.top - a.bottom); return { gap: Math.round(Math.hypot(dx, dy)), dx: Math.round(dx), dy: Math.round(dy), label: label(primary), h1Size: Math.round(h1Px) }; })() : null;
  const navEl = topBar || document.querySelector('header nav, nav, [role="navigation"]');
  const textMid = el => { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); return r.height ? r.top + r.height / 2 : null; };
  const navMisalign = navEl && visible(navEl) && navEl.getBoundingClientRect().top < 4 ? (() => {
    const items = [...navEl.querySelectorAll('a,button')].filter(el => visible(el) && !skipLink(el) && !offscreen(el) && el.getBoundingClientRect().height < 80);
    if (items.length < 3) return null;
    const filled = el => { const c = rgba(getComputedStyle(el).backgroundColor); return c && c[3] > 0.1; }; const logo = items[0], links = items.slice(1).filter(el => !filled(el) && fullText(el));
    const lm = logo.querySelector('img,svg') && !fullText(logo) ? (r => r.top + r.height / 2)(logo.getBoundingClientRect()) : textMid(logo);
    const mids = links.map(textMid).filter(v => v !== null).sort((a, b) => a - b);
    if (lm === null || !mids.length) return null;
    const off = Math.abs(mids[Math.floor(mids.length / 2)] - lm);
    return off > 3 ? { offset: Math.round(off), logo: label(logo) } : null;
  })() : null;
  // A headline broken in two with something laid between its lines.
  const splitHeadline = h1Vis ? (() => {
    const rg = document.createRange(); rg.selectNodeContents(h1Vis);
    const rows = []; for (const r of [...rg.getClientRects()].filter(r => r.width > 4 && r.height > 4).sort((a, b) => a.top - b.top)) { const last = rows[rows.length - 1]; if (last && r.top < last.bottom - Math.min(last.bottom - last.top, r.height) * 0.3) { last.bottom = Math.max(last.bottom, r.bottom); } else rows.push({ top: r.top, bottom: r.bottom }); }
    let worst = 0; for (let i = 1; i < rows.length; i++) { const lh = Math.min(rows[i].bottom - rows[i].top, rows[i - 1].bottom - rows[i - 1].top); const gap = rows[i].top - rows[i - 1].bottom; if (gap > lh * 0.6) worst = Math.max(worst, Math.round(gap)); }
    return worst ? { gap: worst, size: Math.round(h1Px) } : null;
  })() : null;
  // The fold's dominant ground: a neutral near-white or pale grey reads as no world at all.
  const oklab = c => { const lin = c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); const l = Math.cbrt(.4122214708 * lin[0] + .5363325363 * lin[1] + .0514459929 * lin[2]), m = Math.cbrt(.2119034982 * lin[0] + .6806995451 * lin[1] + .1073969566 * lin[2]), q = Math.cbrt(.0883024619 * lin[0] + .2817188376 * lin[1] + .6299787005 * lin[2]); const L = .2104542553 * l + .793617785 * m - .0040720468 * q, a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * q, b = .0259040371 * l + .7827717662 * m - .808675766 * q; return { L, C: Math.hypot(a, b) }; };
  const groundAt = (x, y) => { const layers = []; for (const p of document.elementsFromPoint(x, y)) { const s = getComputedStyle(p); if (s.backgroundImage && s.backgroundImage !== 'none' && !/gradient/.test(s.backgroundImage)) return 'textured'; const c = rgba(s.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } } let base = [255, 255, 255]; for (const c of layers.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return base.map(Math.round).join(','); };
  const groundCounts = {}; let groundSamples = 0;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 8; j++) { const k = groundAt(W * i / 12, H * j / 8); groundCounts[k] = (groundCounts[k] || 0) + 1; groundSamples++; }
  const [groundKey, groundN] = Object.entries(groundCounts).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const ground = groundKey && groundKey !== 'textured' ? (() => { const c = groundKey.split(',').map(Number), o = oklab(c); return { rgb: groundKey, share: Math.round(groundN / groundSamples * 100), L: Math.round(o.L * 1000) / 1000, C: Math.round(o.C * 1000) / 1000 }; })() : { rgb: groundKey, share: Math.round(groundN / groundSamples * 100), textured: true };

  // Surface habits.
  const gradientText = [...document.querySelectorAll('h1,h2,h3,span,strong,em,p')].filter(el => visible(el) && /text/.test(getComputedStyle(el).backgroundClip || getComputedStyle(el).webkitBackgroundClip || '') && getComputedStyle(el).backgroundImage !== 'none').map(el => fullText(el).slice(0, 40));
  const emojiIcons = [...document.querySelectorAll('button,h1,h2,h3,h4,li,span,div')].filter(el => visible(el) && !el.closest(DEMO) && /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(ownText(el))).slice(0, 10).map(el => ownText(el).slice(0, 30));
  const numericCells = [...document.querySelectorAll('td,[role="cell"],[role="gridcell"]')].filter(el => visible(el) && /^[\s$€£¥+\-−]*\d[\d,.\s]*[kKmMbB%]?\s*$/.test(fullText(el)));
  const proportionalNumbers = numericCells.filter(el => !/tabular-nums/.test(getComputedStyle(el).fontVariantNumeric)).length;
  const accentBorders = [...document.querySelectorAll('div,li,article,aside,section,blockquote')].filter(el => { if (!visible(el)) return false; const s = getComputedStyle(el); return (px(s.borderLeftWidth) > 1 && s.borderLeftStyle !== 'none' && px(s.borderRightWidth) === 0 && px(s.borderTopWidth) === 0); }).length;
  const h1 = document.querySelector('h1'); const h1Size = h1 && visible(h1) ? px(getComputedStyle(h1).fontSize) : 0;

  scrollTo({ top: scrollY0, left: 0, behavior: 'instant' });
  return { width: W, height: H, title: document.title, h1Size, headings, sectionStats, heroWords, heroSample: heroSample.join(' ').slice(0, 160), bodyWords, operateProse, longCardText, misaligned, controlHeights, nativeSelects, unthemedChecks, noHover, noFocus, noDisabled, selectionThemed: stateRules.selection, chevronTriggers, gradientText, emojiIcons, numericCells: numericCells.length, proportionalNumbers, accentBorders, smallTargets, clipped, covered, heroGap, hiddenShown, clippedText, edgeCut, faintControls, truncated, type: { h1Family, h1Text: h1Vis ? fullText(h1Vis).slice(0, 80) : '', outsized: outsized.slice(0, 8), firstViewLarge: [...fvLarge], firstViewFamilies: [...fvFamilies], families, characterUse: characterUse.slice(0, 12), characterCount: characterUse.length, proseChars, monoProse }, ctaGap, navMisalign, splitHeadline, ground, overflow: document.documentElement.scrollWidth > W + 1, layout: { appShell: Boolean(document.querySelector('aside nav, [role="navigation"][aria-orientation="vertical"], aside [role="navigation"]')) && !document.querySelector('main section h1 ~ * a[href], footer') } };
}

// Drives every popup trigger with synthetic pointer and keyboard events.
export async function probeMenus(limit = 14) {
  const POP = '[role="menu"],[role="listbox"],[role="dialog"],dialog[open],[role="tree"],[role="grid"],[popover]';
  const visible = el => { if (!el || !el.isConnected || el.closest('[hidden]')) return false; for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const key = (el, k) => (el || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true, cancelable: true }));
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 50) || el.tagName.toLowerCase();
  const px = v => parseFloat(v) || 0;
  const hoverSel = []; const focusSel = [];
  const walk = rules => { for (const rule of rules) { if (rule.cssRules && !rule.selectorText) { try { walk(rule.cssRules); } catch {} continue; } const sel = rule.selectorText; if (!sel) continue; for (const part of sel.split(',')) { if (/:hover/.test(part)) hoverSel.push(part.replace(/:hover/g, '').trim() || '*'); if (/:focus|\[data-(highlighted|active)|\[aria-selected|\.(is-)?(active|highlighted|focused)/.test(part)) focusSel.push(part.replace(/:focus(-visible|-within)?/g, '').trim() || '*'); } } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
  const ruleFor = (el, list) => { for (let p = el, i = 0; p && i < 3; p = p.parentElement, i++) for (const s of list) { try { if (p.matches(s)) return true; } catch {} } return false; };
  const closeAll = async () => { key(document.activeElement, 'Escape'); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.body.click(); await sleep(200); };
  // Product scenes are operated by visitors and judges too: probe their popups, after the page's own.
  const inDemo = el => Boolean(el.closest('[data-demo],figure'));
  const triggers = [...document.querySelectorAll('[aria-haspopup]:not([aria-haspopup="false"]),[role="combobox"]')].filter(el => visible(el) && !el.closest('[aria-hidden="true"],[inert]')).sort((a, b) => inDemo(a) - inDemo(b)).slice(0, limit);
  const results = [];
  for (const trigger of triggers) {
    const res = { trigger: label(trigger), kind: trigger.getAttribute('aria-haspopup') || 'combobox', problems: [] };
    const before = new Set([...document.querySelectorAll(POP)].filter(visible));
    trigger.scrollIntoView({ block: 'center' }); trigger.focus(); trigger.click(); await sleep(320);
    const controlsId = trigger.getAttribute('aria-controls') || trigger.getAttribute('aria-owns');
    let popup = controlsId && document.getElementById(controlsId); if (!visible(popup)) popup = [...document.querySelectorAll(POP)].find(el => visible(el) && !before.has(el)) || null;
    if (!popup) { trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(320); popup = (controlsId && visible(document.getElementById(controlsId)) && document.getElementById(controlsId)) || [...document.querySelectorAll(POP)].find(el => visible(el) && !before.has(el)) || null; }
    if (!popup) { res.problems.push('no-popup'); results.push(res); await closeAll(); continue; }
    if (trigger.hasAttribute('aria-expanded') && trigger.getAttribute('aria-expanded') !== 'true') res.problems.push('aria-expanded-stale');
    const pr = popup.getBoundingClientRect(), ps = getComputedStyle(popup);
    if (pr.left < -1 || pr.right > innerWidth + 1) res.problems.push('offscreen');
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, pr.left + pr.width / 2)), Math.min(innerHeight - 1, Math.max(0, pr.top + Math.min(pr.height / 2, 20))));
    if (pr.top >= 0 && pr.top < innerHeight && hit && !popup.contains(hit) && hit !== popup) res.problems.push('covered-or-clipped');
    const isDialog = /dialog/.test(popup.getAttribute('role') || popup.tagName.toLowerCase()) || res.kind === 'dialog';
    if (!isDialog) {
      const elevated = ps.boxShadow !== 'none' || (px(ps.borderTopWidth) > 0 && ps.borderTopStyle !== 'none');
      if (!elevated || px(ps.borderTopLeftRadius) < 4) res.problems.push('unstyled-surface');
      const items = [...popup.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"]')].filter(visible);
      if (!items.length) res.problems.push('no-item-roles');
      else {
        const minH = Math.min(...items.map(i => i.getBoundingClientRect().height)); if (minH < 28) res.problems.push(`cramped-items:${Math.round(minH)}px`);
        const snap = () => items.map(i => i.className + '|' + i.getAttribute('aria-selected') + '|' + i.getAttribute('data-highlighted') + '|' + i.getAttribute('data-active') + '|' + i.getAttribute('tabindex')).join(';');
        if (!items.every(i => ruleFor(i, hoverSel))) {
          const target = items[Math.min(1, items.length - 1)], before = snap();
          for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) target.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, { bubbles: !/enter/.test(type) }));
          await sleep(60);
          if (snap() === before) res.problems.push('item-no-hover');
        }
        if (!items.every(i => ruleFor(i, focusSel))) res.problems.push('item-no-highlight');
        const s0 = snap(), a0 = document.activeElement, ad0 = document.querySelector('[aria-activedescendant]')?.getAttribute('aria-activedescendant') || '';
        key(document.activeElement, 'ArrowDown'); await sleep(120);
        const ad1 = document.querySelector('[aria-activedescendant]')?.getAttribute('aria-activedescendant') || '';
        const moved = (popup.contains(document.activeElement) && document.activeElement !== a0) || ad1 !== ad0 || snap() !== s0 || (popup.contains(a0) && document.activeElement !== a0);
        const usable = items.filter(i => i.getAttribute('aria-disabled') !== 'true' && !i.matches(':disabled')).length;
        if (!moved && usable > 1) res.problems.push('no-arrow-keys');
      }
    }
    key(document.activeElement, 'Escape'); await sleep(320);
    const closed = !visible(popup);
    if (!closed) res.problems.push('escape-does-not-close');
    else if (!(document.activeElement === trigger || trigger.contains(document.activeElement))) res.problems.push('focus-not-returned');
    if (!closed) await closeAll();
    results.push(res);
  }
  return { probed: results.length, results };
}

export function detectMode(snapshot) {
  if (snapshot.layout?.appShell) return 'operate';
  return snapshot.h1Size >= 40 ? 'persuade' : 'operate';
}

const F = (code, severity, message, extra = {}) => ({ code, severity, message, ...extra });

export function assessSlop(snapshot, probe = null, mode = 'auto') {
  if (mode === 'auto') mode = detectMode(snapshot);
  const L = SLOP_LIMITS[mode] || SLOP_LIMITS.operate; const out = [];
  const persuade = mode === 'persuade', operate = mode === 'operate';
  const h1s = snapshot.headings.filter(h => h.level === 1).length;
  if (h1s < L.h1Min || h1s > L.h1Max) out.push(F('h1-count', 'failure', `Found ${h1s} h1 headings; ${mode} surfaces need ${L.h1Min === L.h1Max ? L.h1Min : `${L.h1Min}-${L.h1Max}`}.`));
  const deep = snapshot.headings.filter(h => h.level > L.maxHeadingLevel);
  if (deep.length) out.push(F('heading-depth', 'failure', `${deep.length} headings deeper than h${L.maxHeadingLevel}. Use labels, list terms, or merge sections.`, { samples: deep.slice(0, 4).map(h => `h${h.level} ${h.text}`) }));
  const stacked = snapshot.headings.filter(h => h.stacked);
  if (stacked.length) out.push(F('stacked-headings', mode === 'read' ? 'warning' : 'failure', `${stacked.length} headings are followed directly by a deeper heading with no content between.`, { samples: stacked.slice(0, 4).map(h => h.text) }));
  const eyebrows = snapshot.headings.filter(h => h.eyebrow);
  if (eyebrows.length) out.push(F('eyebrow-label', persuade ? 'failure' : 'warning', `${eyebrows.length} small uppercase or tracked labels sit above headings. Delete them and let the heading carry the meaning.`, { samples: eyebrows.slice(0, 4).map(h => `${h.eyebrow} → ${h.text}`) }));
  const multi = snapshot.sectionStats.filter(s => s.h2 > L.h2PerSection);
  if (multi.length) out.push(F('section-multi-heading', 'failure', `${multi.length} sections carry more than ${L.h2PerSection} h2. One section, one heading.`, { samples: multi.slice(0, 3).map(s => (s.h2Text || []).join(' | ')) }));
  const total = snapshot.headings.filter(h => h.level > 1).length;
  if (total > L.headingsTotal) out.push(F('heading-wall', 'failure', `${total} headings below the h1 (budget ${L.headingsTotal}). Fold small sections together and turn item titles into labels.`));
  const fv = snapshot.headings.filter(h => h.firstView).length;
  if (fv > L.firstViewHeadings) out.push(F('heading-wall', 'failure', `${fv} headings in the first viewport (budget ${L.firstViewHeadings}).`, { samples: snapshot.headings.filter(h => h.firstView).slice(0, 12).map(h => `h${h.level} ${h.text}`) }));
  if (snapshot.heroWords > L.heroWords) out.push(F('hero-copy', 'failure', `First viewport carries ${snapshot.heroWords} words of copy (budget ${L.heroWords}).`, { sample: snapshot.heroSample }));
  if (snapshot.bodyWords > L.bodyWords) out.push(F('copy-budget', 'failure', `Page carries ${snapshot.bodyWords} words of body copy (budget ${L.bodyWords}).`));
  if (operate && snapshot.operateProse > L.prose) out.push(F('prose-budget', 'failure', `Operate screen carries ${snapshot.operateProse} words of explanatory prose (budget ${L.prose}). Labels and states should carry the screen.`));
  if (snapshot.longCardText.length && L.cardLines !== Infinity) out.push(F('card-paragraph', 'failure', `${snapshot.longCardText.length} paragraphs inside cards run past ${L.cardLines} lines.`, { samples: snapshot.longCardText.slice(0, 3) }));
  if (snapshot.misaligned.length) out.push(F('control-misalign', 'failure', `${snapshot.misaligned.length} control rows mix heights or vertical centers by more than 1px.`, { samples: snapshot.misaligned.slice(0, 4) }));
  if (snapshot.controlHeights.length > 4) out.push(F('control-size-sprawl', 'warning', `Controls use ${snapshot.controlHeights.length} different heights (${snapshot.controlHeights.join(', ')} px). Keep to a 3-step scale.`));
  if (snapshot.nativeSelects.length) out.push(F('native-select', 'failure', `${snapshot.nativeSelects.length} unstyled native selects. Use the system select component or appearance:none with the shared control styling.`, { samples: snapshot.nativeSelects.slice(0, 4) }));
  if (snapshot.unthemedChecks) out.push(F('unthemed-checkbox', 'warning', `${snapshot.unthemedChecks} checkboxes or radios use the browser default accent.`));
  if (snapshot.noHover.length) out.push(F('missing-hover', 'failure', `${snapshot.noHover.length} buttons, links styled as buttons, tabs, or items have no hover rule.`, { samples: snapshot.noHover.slice(0, 5) }));
  if (snapshot.noFocus.length) out.push(F('missing-focus-style', 'failure', `${snapshot.noFocus.length} focusable controls have no authored :focus-visible style.`, { samples: snapshot.noFocus.slice(0, 5) }));
  if (snapshot.noDisabled.length) out.push(F('missing-disabled-style', 'failure', `${snapshot.noDisabled.length} disabled controls have no authored disabled style.`, { samples: snapshot.noDisabled.slice(0, 5) }));
  if (snapshot.chevronTriggers.length) out.push(F('dropdown-aria', 'failure', `${snapshot.chevronTriggers.length} dropdown-looking buttons lack aria-haspopup/aria-expanded, so keyboard and screen-reader behavior is unknown.`, { samples: snapshot.chevronTriggers.slice(0, 4) }));
  if (!snapshot.selectionThemed) out.push(F('selection-unthemed', 'warning', 'Text selection uses the browser default; theme ::selection from the palette.'));
  if (snapshot.proportionalNumbers) out.push(F('proportional-numbers', 'warning', `${snapshot.proportionalNumbers} of ${snapshot.numericCells} numeric cells lack tabular-nums.`));
  if (snapshot.gradientText.length) out.push(F('gradient-text', 'failure', `${snapshot.gradientText.length} gradient-filled text runs. Use weight or size for emphasis.`, { samples: snapshot.gradientText.slice(0, 3) }));
  if (snapshot.emojiIcons.length) out.push(F('emoji-icons', 'failure', 'Emoji stand in for icons. Use one drawn icon set.', { samples: snapshot.emojiIcons.slice(0, 4) }));
  if (snapshot.smallTargets?.length) out.push(F('small-target', 'failure', `${snapshot.smallTargets.length} controls are under 32px tall at ${snapshot.width}px. Touch layouts use 40px controls.`, { samples: snapshot.smallTargets.slice(0, 5) }));
  if (snapshot.clipped?.length) out.push(F('clipped-control', 'failure', `${snapshot.clipped.length} controls are cut off by the viewport or an overflow-hidden container.`, { samples: snapshot.clipped.slice(0, 5) }));
  if (snapshot.covered?.length) out.push(F('covered-text', 'failure', `${snapshot.covered.length} text elements sit under a fixed or sticky bar at load. Clear the bar's height (and the safe area) before the first line.`, { samples: snapshot.covered.slice(0, 5) }));
  if (snapshot.heroGap && snapshot.heroGap.gap < Math.max(16, snapshot.heroGap.size * 0.4)) out.push(F('cramped-hero', 'warning', `The h1 starts ${snapshot.heroGap.gap}px below the top bar at ${snapshot.width}px; a ${snapshot.heroGap.size}px headline needs at least ${Math.round(Math.max(16, snapshot.heroGap.size * 0.4))}px of air.`));
  if (snapshot.hiddenShown?.length) out.push(F('hidden-visible', 'failure', `${snapshot.hiddenShown.length} elements carry the hidden attribute but CSS still shows them (a display rule beats [hidden]). Add [hidden]{display:none!important} or toggle a class.`, { samples: snapshot.hiddenShown.slice(0, 5) }));
  if (snapshot.clippedText?.length) out.push(F('clipped-text', snapshot.clippedText.length > 2 ? 'failure' : 'warning', `${snapshot.clippedText.length} text runs are cut off by their container with no ellipsis, product scenes included. Give labels room, wrap them, or show them on selection.`, { samples: snapshot.clippedText.slice(0, 5) }));
  if (snapshot.faintControls?.length) out.push(F('control-contrast', 'failure', `${snapshot.faintControls.length} enabled controls have label contrast under 3:1 against their background, so they read as missing.`, { samples: snapshot.faintControls.slice(0, 5) }));
  if (snapshot.truncated?.length > 2) out.push(F('truncated-text', snapshot.width <= 480 ? 'failure' : 'warning', `${snapshot.truncated.length} text runs are cut with an ellipsis. Wrap names and primary values; truncate only secondary metadata.`, { samples: snapshot.truncated.slice(0, 5) }));
  const T = snapshot.type;
  if (persuade && T) {
    if (T.outsized.length) out.push(F('outsized-display', 'failure', `${T.outsized.length} text runs in the first viewport are larger than the ${snapshot.h1Size}px headline. The headline is the largest text; set totals and counters inside the artifact below its size.`, { samples: T.outsized.slice(0, 4).map(o => `${o.text} (${o.size}px)`) }));
    if (T.firstViewLarge.length > 1) out.push(F('two-display-faces', 'warning', `${T.firstViewLarge.length} families are set at 40px or more in the first viewport (${T.firstViewLarge.join(', ')}). Only one family is ever set large in a viewport.`));
    if (T.characterCount > SLOP_TYPE.characterUses) out.push(F('character-face-sprawl', T.characterCount > SLOP_TYPE.characterUses * 2 ? 'failure' : 'warning', `The character face ${T.h1Family} sets ${T.characterCount} text runs beyond the h1. Keep it to the h1 and one signature line; section heads, prices, times, and sentences use the text face.`, { samples: T.characterUse.slice(0, 5) }));
    if (T.proseChars > 300 && T.monoProse / T.proseChars > 0.4) out.push(F('mono-prose', 'failure', `${Math.round(T.monoProse / T.proseChars * 100)}% of the page's sentences are set in a monospace face. Mono is for code, values, and labels; body copy uses the text face.`));
  }
  if (T && T.families.length > 3) out.push(F('font-sprawl', persuade ? 'failure' : 'warning', `${T.families.length} font families carry text (${T.families.map(f => f.family).join(', ')}). Use display, text, and at most one data face.`));
  if (persuade && snapshot.width > 480 && snapshot.ctaGap && snapshot.ctaGap.gap > Math.max(SLOP_TYPE.ctaGapMin, snapshot.ctaGap.h1Size * SLOP_TYPE.ctaGapRatio)) out.push(F('cta-far', 'failure', `The primary action (“${snapshot.ctaGap.label}”) sits ${snapshot.ctaGap.gap}px from the headline. Put it directly under the supporting sentence, on the headline's edge.`));
  if (persuade && snapshot.splitHeadline) out.push(F('split-headline', 'failure', `The headline is broken by a ${snapshot.splitHeadline.gap}px gap between its lines. Set the headline as one block; put the product scene after it or behind it.`));
  if (persuade && snapshot.ground && !snapshot.ground.textured && snapshot.ground.share >= 50 && snapshot.ground.L >= SLOP_TYPE.groundL && snapshot.ground.C < SLOP_TYPE.groundC) out.push(F('neutral-ground', 'warning', `${snapshot.ground.share}% of the first viewport sits on a neutral near-white ground (rgb ${snapshot.ground.rgb}). Make the ground the world's material: a light tint of manila, ledger buff, enamel, or newsprint.`));
  if (snapshot.edgeCut?.length) out.push(F('edge-cut-text', 'failure', `${snapshot.edgeCut.length} text runs are cut by the viewport edge at ${snapshot.width}px. Only a plain object may bleed off the page; boards, tables, and labelled scenes sit whole inside the grid.`, { samples: snapshot.edgeCut.slice(0, 5) }));
  if (persuade && T?.h1Text && /^every\s/i.test(T.h1Text)) out.push(F('formula-headline', 'warning', `The headline opens with the "Every …" formula ("${T.h1Text}"). Write the promise in the world's own vocabulary instead.`));
  if (persuade && T?.firstViewFamilies && T.firstViewFamilies.length > SLOP_TYPE.viewportFamilies) out.push(F('viewport-voices', 'warning', `${T.firstViewFamilies.length} font families share the first viewport (${T.firstViewFamilies.join(', ')}). Keep to display, text, and one data face.`));
  if (snapshot.navMisalign) out.push(F('nav-misalign', 'warning', `Nav links sit ${snapshot.navMisalign.offset}px off the logo's vertical centre. Align logo, links, and action on one centre line.`));
  if (snapshot.overflow) out.push(F('page-overflow', 'failure', `The page scrolls horizontally at ${snapshot.width}px.`));
  if (snapshot.accentBorders > 2) out.push(F('accent-border', 'warning', `${snapshot.accentBorders} blocks use a thick one-sided accent border.`));
  if (probe) for (const r of probe.results) if (r.problems.length) {
    out.push(F('menu-behavior', 'failure', `Popup from “${r.trigger}”: ${r.problems.join(', ')}.`, { trigger: r.trigger, problems: r.problems }));
  }
  return { mode, findings: out, status: out.some(f => f.severity === 'failure') ? 'failed' : out.length ? 'warnings' : 'passed' };
}

// Browser-evaluable script for hosts without Playwright: returns {snapshot, probe}.
export function slopScript({ probe = true } = {}) {
  return `(async () => { const collect = ${collectSlopDOM.toString()}; const probeMenus = ${probeMenus.toString()}; await document.fonts.ready; const snapshot = collect(); const probe = ${probe ? 'await probeMenus()' : 'null'}; return JSON.stringify({ snapshot, probe }); })()`;
}
