document.addEventListener('DOMContentLoaded', function() {

  // ── Mobile nav toggle (persistent) ──────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const siteNav   = document.getElementById('siteNav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => siteNav.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!navToggle.contains(e.target) && !siteNav.contains(e.target)) {
        siteNav.classList.remove('open');
      }
    });
  }

  // ── Dark mode toggle (persistent) ────────────────────────────────────────
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const html = document.documentElement;
    const isDark = () => html.getAttribute('data-theme') === 'dark';

    themeToggle.textContent = isDark() ? '☾' : '☀';

    themeToggle.addEventListener('click', () => {
      if (isDark()) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '☀';
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☾';
      }
    });
  }

  // ── Music player (persistent) ────────────────────────────────────────────
  const musicPlayer = document.getElementById('musicPlayer');
  if (musicPlayer) {
    const audio     = document.getElementById('mpAudio');
    const playBtn   = document.getElementById('mpPlayBtn');
    const iconPlay  = playBtn.querySelector('.mp-icon-play');
    const iconPause = playBtn.querySelector('.mp-icon-pause');
    const timeline  = document.getElementById('mpTimeline');
    const progress  = document.getElementById('mpProgress');
    const thumb     = document.getElementById('mpThumb');
    const volBtn    = document.getElementById('mpVolBtn');
    const iconVol   = volBtn.querySelector('.mp-icon-vol');
    const iconMute  = volBtn.querySelector('.mp-icon-mute');
    const volSlider = document.getElementById('mpVolSlider');

    audio.src = musicPlayer.dataset.src;
    audio.volume = parseFloat(volSlider.value);
    document.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
    }, { once: true });

    function setPlaying(playing) {
      iconPlay.style.display  = playing ? 'none' : '';
      iconPause.style.display = playing ? '' : 'none';
    }

    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play(); } else { audio.pause(); }
    });
    audio.addEventListener('play',  () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => setPlaying(false));

    function updateProgress() {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      progress.style.width = pct + '%';
      thumb.style.left = pct + '%';
    }
    audio.addEventListener('timeupdate', updateProgress);

    function seekTo(e) {
      if (!audio.duration) return;
      const rect = timeline.getBoundingClientRect();
      const pct  = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * audio.duration;
      updateProgress();
    }
    let seeking = false;
    timeline.addEventListener('mousedown', e => { seeking = true; seekTo(e); });
    document.addEventListener('mousemove', e => { if (seeking) seekTo(e); });
    document.addEventListener('mouseup',   () => { seeking = false; });
    timeline.addEventListener('touchstart', e => { seeking = true; seekTo(e.touches[0]); }, { passive: true });
    document.addEventListener('touchmove',  e => { if (seeking) seekTo(e.touches[0]); }, { passive: true });
    document.addEventListener('touchend',   () => { seeking = false; });

    volSlider.addEventListener('input', () => {
      audio.volume = parseFloat(volSlider.value);
      if (audio.muted && audio.volume > 0) audio.muted = false;
      iconVol.style.display  = audio.muted || audio.volume === 0 ? 'none' : '';
      iconMute.style.display = audio.muted || audio.volume === 0 ? '' : 'none';
    });

    volBtn.addEventListener('click', () => {
      audio.muted = !audio.muted;
      iconVol.style.display  = audio.muted ? 'none' : '';
      iconMute.style.display = audio.muted ? '' : 'none';
    });

    const loopBtn = document.getElementById('mpLoopBtn');
    if (loopBtn) {
      audio.loop = true;
      loopBtn.classList.add('active');
      loopBtn.addEventListener('click', () => {
        audio.loop = !audio.loop;
        loopBtn.classList.toggle('active', audio.loop);
      });
    }
  }

  // ── AJAX navigation — keeps music player alive across page changes ────────
  function fetchAndSwap(url, push) {
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(html => {
        const doc     = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.querySelector('main');
        const curMain = document.querySelector('main');
        if (!newMain || !curMain) { location.href = url; return; }

        curMain.innerHTML = newMain.innerHTML;
        document.title = doc.title;
        if (push) history.pushState({}, doc.title, url);

        // Update active nav link
        const destPath = new URL(url, location.origin).pathname;
        document.querySelectorAll('.nav-link').forEach(a => {
          const aPath = new URL(a.href, location.origin).pathname;
          a.classList.toggle('active', aPath === destPath);
        });

        if (siteNav) siteNav.classList.remove('open');
        window.scrollTo(0, 0);
        initPageContent();
      })
      .catch(() => { location.href = url; });
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    const url = link.href;
    if (!url) return;
    try { if (new URL(url).origin !== location.origin) return; } catch { return; }
    if (new URL(url).pathname === location.pathname) return;
    e.preventDefault();
    fetchAndSwap(url, true);
  });

  window.addEventListener('popstate', () => fetchAndSwap(location.href, false));

  // ── Citation helpers ──────────────────────────────────────────────────────
  let activeCiteData = null;
  let activeFmt = 'apa';

  function parseAuthor(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return { family: parts[0] || '', given: '' };
    return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') };
  }

  function formatAuthorsApa(str) {
    if (!str) return '[Author(s)]';
    const authors = str.split(',').map(s => s.trim()).filter(Boolean);
    const fmt = authors.map(name => {
      const { family, given } = parseAuthor(name);
      const initials = given ? given.split(/\s+/).filter(p => p).map(p => p[0] + '.').join(' ') : '';
      return initials ? `${family}, ${initials}` : family;
    });
    if (fmt.length === 1) return fmt[0];
    if (fmt.length === 2) return `${fmt[0]}, & ${fmt[1]}`;
    return fmt.slice(0, -1).join(', ') + ', & ' + fmt[fmt.length - 1];
  }

  function formatAuthorsBibtex(str) {
    if (!str) return '';
    return str.split(',').map(name => {
      const { family, given } = parseAuthor(name.trim());
      return given ? `${family}, ${given}` : family;
    }).join(' and ');
  }

  function buildApa(d) {
    const authorStr = formatAuthorsApa(d.authors);
    let cite = '';
    if (d.source) {
      const vol = d.volume ? `, ${d.volume}` : '';
      const iss = d.issue  ? `(${d.issue})` : '';
      const pp  = d.pages  ? `, ${d.pages}` : '';
      cite = `${authorStr} (${d.year || 'n.d.'}). ${d.title}. ${d.source}${vol}${iss}${pp}.`;
    } else {
      cite = `${authorStr} (${d.year || 'n.d.'}). ${d.title}.`;
    }
    if (d.doi) cite += ` https://doi.org/${d.doi}`;
    return cite;
  }

  function buildBibtex(d) {
    const firstAuthor = d.authors ? parseAuthor(d.authors.split(',')[0].trim()) : null;
    const keyBase = firstAuthor ? firstAuthor.family : (d.source || 'article');
    const key = keyBase.replace(/\s+/g, '').slice(0, 12) + (d.year || '');
    const lines = [`@article{${key},`];
    lines.push(`  author  = {${formatAuthorsBibtex(d.authors)}},`);
    lines.push(`  title   = {${d.title || ''}},`);
    lines.push(`  journal = {${d.source || ''}},`);
    if (d.year)   lines.push(`  year    = {${d.year}},`);
    if (d.volume) lines.push(`  volume  = {${d.volume}},`);
    if (d.issue)  lines.push(`  number  = {${d.issue}},`);
    if (d.pages)  lines.push(`  pages   = {${d.pages}},`);
    if (d.doi)    lines.push(`  doi     = {${d.doi}},`);
    lines.push('}');
    return lines.join('\n');
  }

  function updateCiteText() {
    const el = document.getElementById('citeText');
    if (!el || !activeCiteData) return;
    el.textContent = activeFmt === 'apa' ? buildApa(activeCiteData) : buildBibtex(activeCiteData);
  }

  function showShareMenu(anchor, url, title) {
    document.querySelectorAll('.share-menu').forEach(m => m.remove());
    const enc  = encodeURIComponent(url);
    const enct = encodeURIComponent(title);
    const items = [
      { icon: '𝕏', label: 'Twitter / X',  href: `https://twitter.com/intent/tweet?url=${enc}&text=${enct}` },
      { icon: 'in', label: 'LinkedIn',     href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}` },
      { icon: 'f',  label: 'Facebook',     href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
      { icon: '📋', label: 'Kopiuj link',  copy: url }
    ];
    const menu = document.createElement('div');
    menu.className = 'share-menu';
    menu.innerHTML = items.map((it, i) =>
      `<button class="share-menu-item" data-i="${i}"><span class="share-menu-icon">${it.icon}</span>${it.label}</button>`
    ).join('');
    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    const menuW = 180;
    let left = rect.right + window.scrollX - menuW;
    let top  = rect.bottom + window.scrollY + 6;
    if (left < 8) left = 8;
    menu.style.cssText = `position:absolute;top:${top}px;left:${left}px;width:${menuW}px`;

    menu.querySelectorAll('.share-menu-item').forEach((el, i) => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const it = items[i];
        if (it.copy) {
          navigator.clipboard.writeText(it.copy).then(() => {
            el.innerHTML = `<span class="share-menu-icon">✓</span>Skopiowano!`;
            setTimeout(() => menu.remove(), 1200);
          }).catch(() => {
            prompt('Skopiuj link:', it.copy);
            menu.remove();
          });
        } else {
          window.open(it.href, '_blank', 'noopener,width=600,height=400');
          menu.remove();
        }
      });
    });

    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }

  // ── Page content init — called on load and after every AJAX swap ──────────
  function initPageContent() {

    // Abstract toggle for publications
    document.querySelectorAll('.abstract-toggle').forEach(btn => {
      const body = btn.nextElementSibling;
      if (!body) return;
      body.removeAttribute('hidden');
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.querySelector('.abstract-toggle-label').textContent =
          expanded ? 'Show abstract' : 'Hide abstract';
        body.classList.toggle('is-open', !expanded);
      });
    });

    // Publications: tag filter
    const filterBar = document.getElementById('pubFilterBar');
    if (filterBar) {
      filterBar.addEventListener('click', e => {
        const btn = e.target.closest('.pub-filter-btn');
        if (!btn) return;
        filterBar.querySelectorAll('.pub-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tag = btn.dataset.tag;
        document.querySelectorAll('.pub-card').forEach(card => {
          if (tag === 'all') {
            card.style.display = '';
          } else {
            const cardTags = card.dataset.pubTags
              ? card.dataset.pubTags.split('|').map(t => t.trim())
              : [];
            card.style.display = cardTags.includes(tag) ? '' : 'none';
          }
        });
      });
    }

    // Publications: citation copy
    document.querySelectorAll('.pub-link--cite').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCiteData = {
          title:   btn.dataset.title   || '',
          authors: btn.dataset.authors || '',
          source:  btn.dataset.source  || '',
          year:    btn.dataset.year    || '',
          volume:  btn.dataset.volume  || '',
          issue:   btn.dataset.issue   || '',
          pages:   btn.dataset.pages   || '',
          doi:     btn.dataset.doi     || ''
        };
        activeFmt = 'apa';
        document.querySelectorAll('.cite-tab').forEach(t => t.classList.toggle('active', t.dataset.fmt === 'apa'));
        updateCiteText();
        document.getElementById('citeOverlay').style.display = 'flex';
        document.getElementById('citeCopied').style.display = 'none';
      });
    });

    document.querySelectorAll('.cite-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cite-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeFmt = tab.dataset.fmt;
        updateCiteText();
        document.getElementById('citeCopied').style.display = 'none';
      });
    });

    const citeOverlay = document.getElementById('citeOverlay');
    const citeClose   = document.getElementById('citeClose');
    if (citeClose) citeClose.addEventListener('click', () => citeOverlay.style.display = 'none');
    if (citeOverlay) citeOverlay.addEventListener('click', e => {
      if (e.target === citeOverlay) citeOverlay.style.display = 'none';
    });

    const citeCopyBtn = document.getElementById('citeCopyBtn');
    if (citeCopyBtn) {
      citeCopyBtn.addEventListener('click', async () => {
        const text = document.getElementById('citeText').textContent;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        const copied = document.getElementById('citeCopied');
        copied.style.display = 'inline';
        setTimeout(() => copied.style.display = 'none', 2000);
      });
    }

    // Article share buttons
    document.querySelectorAll('.article-share-icon').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const url   = btn.dataset.shareUrl;
        const title = btn.dataset.shareTitle;
        if (navigator.share) {
          navigator.share({ title, url }).catch(() => {});
        } else {
          showShareMenu(btn, url, title);
        }
      });
    });
  }

  // Run on initial page load
  initPageContent();

});
