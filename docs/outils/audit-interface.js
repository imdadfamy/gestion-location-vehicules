/* Outil de mesure de l'interface (développement uniquement) — voir docs/architecture.md, section « Typographie et tailles ». */
/* Usage : copier ce fichier dans web/public/__audit.js (NE PAS le versionner ni le déployer), lancer le site en local, se connecter, puis dans la console du navigateur :
   await import('/__audit.js') ; window.__fmt(await window.__audit(['/partner','/partner/rentals'], 375, 812))   (pages)
   await window.__overlays(['/app/clients', {url:'/app/rentals', button:'Nouvelle location'}], 375, 812)            (panneaux)
   Effacer ensuite web/public/__audit.js. */
/* Outil de mesure TEMPORAIRE (non versionné) : charge chaque page dans un cadre de la largeur voulue et relève
   débordements, textes trop petits, cibles tactiles trop basses, textes coupés et chevauchements d'en-tête. */
window.__audit = async function (urls, width, height, wait = 4500) {
  const out = [];
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;border:0`;
  document.body.appendChild(frame);
  const short = (el) => (el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/).slice(0, 2).join('.')).slice(0, 50);
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  for (const url of urls) {
    await new Promise((resolve) => { frame.onload = resolve; frame.src = url; });
    await new Promise((r) => setTimeout(r, wait));
    const d = frame.contentDocument;
    const w = frame.contentWindow;
    if (!d || !d.body) { out.push({ url, error: 'no document' }); continue; }
    const cs = (el) => w.getComputedStyle(el);
    const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return false; const s = cs(el); return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
    const scrollable = (el) => { for (let p = el.parentElement; p && p !== d.body; p = p.parentElement) { const o = cs(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
    const res = { url: url.replace(location.origin, ''), title: d.title.slice(0, 30) };
    // 1. débordement horizontal
    const innerW = w.innerWidth;
    res.overflowX = d.documentElement.scrollWidth > innerW + 1;
    res.offenders = [...d.body.querySelectorAll('*')].filter((el) => visible(el) && el.getBoundingClientRect().right > innerW + 1 && !scrollable(el)).slice(0, 3).map((el) => short(el) + ' → ' + Math.round(el.getBoundingClientRect().right));
    // 2. textes trop petits (< 14 px)
    let total = 0, tinyCount = 0, min = 99; const tinySamples = [];
    for (const el of d.body.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) continue;
      const fs = parseFloat(cs(el).fontSize);
      total += 1; min = Math.min(min, fs);
      if (fs < 13.9) { tinyCount += 1; if (tinySamples.length < 3) tinySamples.push(Math.round(fs * 10) / 10 + 'px "' + text(el) + '"'); }
    }
    res.tiny = { count: tinyCount, total, min: Math.round(min * 10) / 10, samples: tinySamples };
    // 3. cibles tactiles trop basses (téléphone)
    if (width <= 480) {
      const sel = 'button,input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]),select,textarea,[role=combobox],a[data-slot=button]';
      const bad = [...d.body.querySelectorAll(sel)].filter((el) => visible(el) && !el.closest('.sr-only') && el.getBoundingClientRect().height < 38);
      res.targets = { count: bad.length, samples: bad.slice(0, 3).map((el) => short(el) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px "' + text(el) + '"') };
    }
    // 4. textes coupés
    res.clipped = [...d.body.querySelectorAll('*')].filter((el) => {
      if (!visible(el) || !text(el)) return false;
      const s = cs(el);
      const clipX = (s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis';
      const clipY = (s.overflowY === 'hidden' || s.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 3 && s.height !== 'auto' && el.clientHeight > 0 && el.clientHeight < 60;
      return clipX || clipY;
    }).slice(0, 3).map((el) => short(el) + ' "' + text(el) + '"');
    // 5. chevauchement dans l'en-tête
    const header = d.querySelector('header');
    res.overlap = 0;
    if (header) {
      const items = [...header.querySelectorAll('a,button')].filter(visible).map((el) => el.getBoundingClientRect());
      for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i], b = items[j];
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 3 && oy > 3) res.overlap += 1;
      }
    }
    // 6. erreur affichée
    res.error = /Application error|Unhandled Runtime Error|Something went wrong|This page couldn.t load/i.test(d.body.innerText) ? 'ERREUR AFFICHÉE' : '';
    out.push(res);
  }
  frame.remove();
  return out;
};
window.__fmt = (rows) => rows.map((r) => `${r.url} | ${r.error ? r.error : ''}${r.overflowX ? 'OVERFLOW ' : ''}${r.offenders?.length ? '[' + r.offenders.join('; ') + '] ' : ''}tiny ${r.tiny?.count}/${r.tiny?.total} min ${r.tiny?.min}px ${r.tiny?.count ? JSON.stringify(r.tiny.samples) : ''}${r.targets ? ' | cibles<38px: ' + r.targets.count + (r.targets.count ? ' ' + JSON.stringify(r.targets.samples) : '') : ''}${r.clipped?.length ? ' | coupé: ' + JSON.stringify(r.clipped) : ''}${r.overlap ? ' | chevauchement: ' + r.overlap : ''}`).join('\n');

/* Panneaux : ouvre la première ligne de chaque page (ou le bouton indiqué) et mesure le panneau obtenu. */
window.__overlays = async function (items, width, height) {
  const out = [];
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;border:0`;
  document.body.appendChild(frame);
  for (const item of items) {
    const { url, button } = typeof item === 'string' ? { url: item } : item;
    await new Promise((resolve) => { frame.onload = resolve; frame.src = url; });
    await new Promise((r) => setTimeout(r, 4200));
    const d = frame.contentDocument, w = frame.contentWindow;
    const target = button ? [...d.querySelectorAll('button,a')].find((b) => new RegExp(button, 'i').test(b.innerText)) : d.querySelector('tbody tr');
    if (!target) { out.push(`${url}${button ? ' [' + button + ']' : ''} | rien à ouvrir`); continue; }
    target.click();
    await new Promise((r) => setTimeout(r, 1800));
    const dlg = [...d.querySelectorAll('[role=dialog]')].pop();
    if (!dlg) { out.push(`${url}${button ? ' [' + button + ']' : ''} | panneau non ouvert`); continue; }
    const iw = w.innerWidth;
    const scrolls = (el) => { for (let p = el.parentElement; p && p !== dlg; p = p.parentElement) { const o = w.getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const over = [...dlg.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.right > iw + 1 && !e.closest('.sr-only') && !scrolls(e); }).slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 26) + '→' + Math.round(e.getBoundingClientRect().right));
    const small = [...dlg.querySelectorAll('button,input,select,textarea,[role=combobox]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.height < 38 && !e.closest('.sr-only') && !['file', 'checkbox', 'radio'].includes(e.type) && !e.matches('[role=switch]'); }).length;
    const tiny = [...dlg.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(w.getComputedStyle(e).fontSize) < 13.9).length;
    out.push(`${url}${button ? ' [' + button + ']' : ''} | largeur ${Math.round(dlg.getBoundingClientRect().width)} | ${over.length ? 'DÉBORDE ' + JSON.stringify(over) : 'ok'} | cibles<38: ${small} | texte<14: ${tiny}`);
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
  frame.remove();
  return out.join('\n');
};
