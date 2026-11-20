/* Wingman popup controls: menus, single and multi selects, searchable selects, dialogs.
   Pair with controls.css. No dependencies. Markup contract:

   <button class="select-trigger" type="button" data-popup="tz" aria-haspopup="listbox">
     <span class="value">UTC</span><svg class="chev">…</svg></button>
   <div class="pop" id="tz" role="listbox" hidden>
     <div class="pop-search"><input placeholder="Search time zones" aria-label="Search time zones"></div>
     <div class="item" role="option" data-value="UTC" aria-selected="true">UTC<svg class="check">…</svg></div>
   </div>

   role="menu" with role="menuitem" items for actions; add data-multi to a listbox for
   checkbox-style multi select. Wingman.bind(trigger, { onSelect(value, item, state) {} }).
   Behavior: click / ArrowDown / ArrowUp open; arrows, Home, End and typeahead move;
   Enter or Space choose; Escape closes and returns focus; Tab closes and continues;
   outside press closes; the popup flips above when space is short and stays in view. */
(function () {
  const ITEM = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"]';
  let openState = null;

  function bind(trigger, options = {}) {
    if (trigger.__wingman) return trigger.__wingman;
    const pop = document.getElementById(trigger.dataset.popup || trigger.getAttribute('aria-controls'));
    if (!pop) throw new Error('Popup not found for trigger');
    const role = pop.getAttribute('role') || 'menu';
    const multi = pop.hasAttribute('data-multi');
    const search = pop.querySelector('.pop-search input');
    trigger.setAttribute('aria-haspopup', role === 'listbox' ? 'listbox' : role === 'dialog' ? 'dialog' : 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', pop.id);
    if (multi) pop.setAttribute('aria-multiselectable', 'true');
    let typed = '', typedAt = 0, highlighted = null;

    const items = () => [...pop.querySelectorAll(ITEM)].filter(el => !el.hidden && el.offsetParent !== null);
    const enabled = () => items().filter(el => el.getAttribute('aria-disabled') !== 'true');
    pop.querySelectorAll(ITEM).forEach((el, i) => { el.tabIndex = -1; if (!el.id) el.id = `${pop.id}-i${i}`; });

    function highlight(el, { focus = !search } = {}) {
      if (highlighted) highlighted.removeAttribute('data-highlighted');
      highlighted = el || null;
      if (!el) { search?.removeAttribute('aria-activedescendant'); return; }
      el.setAttribute('data-highlighted', '');
      el.scrollIntoView({ block: 'nearest' });
      if (search) search.setAttribute('aria-activedescendant', el.id); else if (focus) el.focus({ preventScroll: true });
    }

    function place() {
      const r = trigger.getBoundingClientRect(), gap = 6, margin = 8;
      pop.style.minWidth = `${Math.max(r.width, 200)}px`;
      const h = pop.offsetHeight, w = pop.offsetWidth;
      const below = innerHeight - r.bottom - margin, above = r.top - margin;
      const up = below < h + gap && above > below;
      const top = up ? Math.max(margin, r.top - gap - h) : Math.min(innerHeight - margin - h, r.bottom + gap);
      const alignRight = pop.dataset.align === 'end';
      let left = alignRight ? r.right - w : r.left;
      left = Math.min(Math.max(margin, left), innerWidth - margin - w);
      pop.style.top = `${Math.round(top)}px`; pop.style.left = `${Math.round(left)}px`;
      pop.style.setProperty('--origin', `${alignRight ? 'right' : 'left'} ${up ? 'bottom' : 'top'}`);
      pop.style.setProperty('--from-y', up ? '4px' : '-4px');
    }

    function open(from = 'first') {
      if (openState && openState.api !== api) openState.api.close({ focus: false });
      pop.hidden = false; pop.dataset.state = 'open'; trigger.setAttribute('aria-expanded', 'true');
      place(); openState = { api, trigger, pop };
      if (search) { search.value = ''; filter(''); search.focus(); }
      const list = enabled(), selected = list.find(el => el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true');
      highlight(from === 'last' ? list.at(-1) : (!multi && selected) || list[0]);
      addEventListener('scroll', place, true); addEventListener('resize', place);
    }

    function close({ focus = true } = {}) {
      if (pop.hidden) return;
      pop.hidden = true; delete pop.dataset.state; trigger.setAttribute('aria-expanded', 'false');
      highlight(null); removeEventListener('scroll', place, true); removeEventListener('resize', place);
      if (openState?.api === api) openState = null;
      if (focus) trigger.focus({ preventScroll: true });
    }

    function choose(el) {
      if (!el || el.getAttribute('aria-disabled') === 'true') return;
      const value = el.dataset.value ?? el.textContent.trim();
      if (role === 'listbox') {
        if (multi) { const next = el.getAttribute('aria-selected') !== 'true'; el.setAttribute('aria-selected', String(next)); el.setAttribute('aria-checked', String(next)); }
        else { pop.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', String(o === el))); const out = trigger.querySelector('.value'); if (out) { out.textContent = el.dataset.label ?? el.firstChild?.textContent?.trim() ?? value; trigger.removeAttribute('data-placeholder'); } }
      } else if (el.getAttribute('role') === 'menuitemcheckbox') el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true'));
      const selected = [...pop.querySelectorAll('[aria-selected="true"],[aria-checked="true"]')].map(o => o.dataset.value ?? o.textContent.trim());
      options.onSelect?.(value, el, { selected });
      trigger.dispatchEvent(new CustomEvent('wingman:select', { bubbles: true, detail: { value, selected } }));
      if (!multi && el.getAttribute('role') !== 'menuitemcheckbox') close();
    }

    function filter(q) {
      const query = q.trim().toLowerCase(); let shown = 0;
      pop.querySelectorAll(ITEM).forEach(el => { const hit = !query || el.textContent.toLowerCase().includes(query); el.hidden = !hit; if (hit) shown++; });
      let empty = pop.querySelector('.pop-empty');
      if (!shown && !empty) { empty = document.createElement('div'); empty.className = 'pop-empty'; pop.append(empty); }
      if (empty) { empty.textContent = shown ? '' : `No matches for “${q.trim()}”`; empty.hidden = Boolean(shown); }
      highlight(enabled()[0], { focus: false }); place();
    }

    function move(delta) {
      const list = enabled(); if (!list.length) return;
      const i = list.indexOf(highlighted);
      highlight(list[(i + delta + list.length) % list.length]);
    }

    trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
    trigger.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowUp' ? 'last' : 'first'); }
    });
    pop.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (k === 'Home' && !search) { e.preventDefault(); highlight(enabled()[0]); }
      else if (k === 'End' && !search) { e.preventDefault(); highlight(enabled().at(-1)); }
      else if (k === 'Enter' || (k === ' ' && !search)) { e.preventDefault(); choose(highlighted); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (k === 'Tab') { close(); }
      else if (!search && k.length === 1 && !e.metaKey && !e.ctrlKey) {
        const now = Date.now(); typed = now - typedAt > 600 ? k : typed + k; typedAt = now;
        const hit = enabled().find(el => el.textContent.trim().toLowerCase().startsWith(typed.toLowerCase())); if (hit) highlight(hit);
      }
    });
    search?.addEventListener('input', () => filter(search.value));
    pop.addEventListener('pointermove', e => { const el = e.target.closest(ITEM); if (el && el !== highlighted && el.getAttribute('aria-disabled') !== 'true') highlight(el, { focus: !search }); });
    pop.addEventListener('click', e => { const el = e.target.closest(ITEM); if (el) choose(el); });

    const api = { open, close, trigger, pop, get isOpen() { return !pop.hidden; } };
    trigger.__wingman = api;
    return api;
  }

  document.addEventListener('pointerdown', e => {
    if (!openState) return;
    if (openState.pop.contains(e.target) || openState.trigger.contains(e.target)) return;
    openState.api.close({ focus: false });
  }, true);

  // Modal dialog with focus return on every exit path (Escape, Cancel, close, success).
  function dialog(el, { onClose } = {}) {
    let returnTo = null;
    el.addEventListener('close', () => { onClose?.(el.returnValue); (returnTo && returnTo.isConnected ? returnTo : document.body).focus?.(); });
    el.addEventListener('click', e => { if (e.target === el) el.close('dismiss'); });
    return { open() { returnTo = document.activeElement; el.showModal(); (el.querySelector('[autofocus]') || el.querySelector('input,select,textarea,button'))?.focus(); }, close(v) { el.close(v); } };
  }

  function bindAll(root = document) { root.querySelectorAll('[data-popup]').forEach(t => bind(t)); }
  window.Wingman = { bind, bindAll, dialog };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bindAll()); else bindAll();
})();
