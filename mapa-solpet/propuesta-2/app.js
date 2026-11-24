// Propuesta 2: mapa a pantalla completa + tarjetas deslizables + lista completa
(function () {
  const S = window.Solpet;
  const STORES = window.SOLPET_TIENDAS;
  const $ = s => document.querySelector(s);
  const wide = matchMedia('(min-width: 900px)');

  const bar = $('.bar');
  const deck = $('#deck');
  const deckBox = $('.deck');
  const count = $('#store-count');
  const query = $('#store-q');
  const nearBtn = $('#near-me');
  const sheet = $('#sheet');
  const list = $('#store-list');
  const openBtn = $('#open-list');
  const closeBtn = $('#close-list');
  const [prevBtn, nextBtn] = document.querySelectorAll('.deck__nav');
  let selectedId = null, userPos = null, listOpen = false;

  // espacio libre del mapa: entre la barra de arriba y las tarjetas (o al lado de la lista abierta)
  function padding() {
    const h = window.innerHeight;
    const topPad = bar.getBoundingClientRect().bottom + 24;
    let bottom = 40, left = 30;
    if (listOpen && wide.matches) left = sheet.getBoundingClientRect().right + 30;
    if (!(listOpen && !wide.matches)) bottom = h - deck.getBoundingClientRect().top + 24;
    return { top: Math.min(topPad, h * 0.45), bottom: Math.min(bottom, h * 0.45), left, right: 30 };
  }

  const view = S.createMap({
    container: 'map',
    stores: STORES,
    padding,
    controlsPosition: 'top-right',
    controls: false,
    onPin: id => select(id, { scrollCard: true }),
    onReady: () => {
      view.fit(current(), false);
      if (selectedId !== null) select(selectedId, { fly: true, scrollCard: true });
    }
  });
  if (view.map && wide.matches) view.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  const current = () => S.filter(STORES, query.value, userPos);

  // ---------- tarjetas ----------
  function card(s) {
    const li = S.el('li', 'card');
    li.dataset.id = s.id;
    const pick = S.el('button', 'card__pick');
    pick.type = 'button';
    pick.setAttribute('aria-label', `${s.name}, ${s.addr}, ${s.district}. Ver en el mapa`);
    pick.append(S.el('span', 'card__district', s.district), S.el('span', 'store__name', s.name), S.el('span', 'store__addr', s.addr));
    const foot = S.el('div', 'card__foot');
    const go = S.goLink(s, 'Cómo llegar', 'btn btn--verde card__go');
    foot.appendChild(go);
    if (s.url) foot.appendChild(S.webLink(s));
    if (s.km !== undefined) foot.appendChild(S.el('span', 'store__dist', S.distanceText(s.km)));
    li.append(S.logo(s), pick, foot);
    li.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      select(s.id, { fly: true, scrollCard: true });
    });
    return li;
  }

  function moreCard(rest) {
    const li = S.el('li', 'card card--more');
    const online = rest.filter(s => s.online).length, local = rest.length - online;
    li.appendChild(S.el('strong', '', [
      local ? S.plural(local, 'local más', 'locales más') : '',
      online ? S.plural(online, 'tienda online', 'tiendas online') : ''
    ].filter(Boolean).join(' y ')));
    li.appendChild(S.el('span', '', rest.map(s => s.name).join(', ') + '.'));
    const btn = S.el('button', 'btn', 'Ver en la lista');
    btn.type = 'button';
    btn.addEventListener('click', () => setList(true));
    li.appendChild(btn);
    return li;
  }

  function render() {
    const items = current();
    const pins = S.onMap(items), rest = items.filter(s => s.lat === undefined);
    count.textContent = S.countText(items, userPos);
    deck.innerHTML = '';
    pins.forEach(s => deck.appendChild(card(s)));
    if (rest.length) deck.appendChild(moreCard(rest));
    if (!items.length) {
      const li = S.el('li', 'card card--more');
      li.append(S.el('strong', '', 'Sin resultados'), S.el('span', '', `No encontramos puntos de venta para “${query.value.trim()}”. Prueba con otro distrito o tienda.`));
      deck.appendChild(li);
    }
    deck.scrollLeft = 0;
    S.renderList(list, items, { selectedId, userPos, query: query.value, onPick: id => { setList(false); select(id, { fly: true, scrollCard: true }); } });
    view.setData(items);
    if (selectedId !== null && !pins.some(s => s.id === selectedId)) clearSelection();
    else if (selectedId !== null) markCard(selectedId);
    updateNav();
  }

  function markCard(id) {
    deck.querySelectorAll('.card').forEach(c => c.classList.toggle('is-active', Number(c.dataset.id) === id));
  }

  function clearSelection() {
    selectedId = null;
    markCard(null);
    S.markActive(list, null);
    view.highlight(null);
  }

  let syncing = false;
  function select(id, { fly = true, scrollCard = false } = {}) {
    const s = STORES[id];
    if (!s || s.lat === undefined) return;
    selectedId = id;
    markCard(id);
    S.markActive(list, id);
    view.highlight(id);
    if (fly) view.focus(s, { zoom: 14.2, duration: 700 });
    if (scrollCard) {
      const c = deck.querySelector(`.card[data-id="${id}"]`);
      if (c) {
        syncing = true;
        const left = wide.matches ? c.offsetLeft - 60 : c.offsetLeft - (deck.clientWidth - c.offsetWidth) / 2;
        deck.scrollTo({ left, behavior: S.reduceMotion ? 'auto' : 'smooth' });
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => { syncing = false; }, 700);
      }
    }
  }

  // al deslizar, la tarjeta que queda al centro enciende su pin
  let scrollTimer, syncTimer, touched = false;
  function centeredCard() {
    const box = deck.getBoundingClientRect();
    const ref = wide.matches ? box.left + 60 : box.left + box.width / 2;
    let best = null, bestD = Infinity;
    deck.querySelectorAll('.card[data-id]').forEach(c => {
      const r = c.getBoundingClientRect();
      const d = wide.matches ? Math.abs(r.left - ref) : Math.abs(r.left + r.width / 2 - ref);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  function onDeckSettled() {
    updateNav();
    if (syncing || !touched) return;
    const c = centeredCard();
    if (c && Number(c.dataset.id) !== selectedId) select(Number(c.dataset.id), { fly: true });
  }
  deck.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(onDeckSettled, 140);
  }, { passive: true });
  ['pointerdown', 'touchstart', 'wheel'].forEach(ev => deck.addEventListener(ev, () => { touched = true; syncing = false; }, { passive: true }));

  // flechas en laptop
  function updateNav() {
    if (!prevBtn) return;
    prevBtn.disabled = deck.scrollLeft < 4;
    nextBtn.disabled = deck.scrollLeft + deck.clientWidth >= deck.scrollWidth - 4;
  }
  [prevBtn, nextBtn].forEach(b => b && b.addEventListener('click', () => {
    touched = true; syncing = false;
    const step = (deck.querySelector('.card')?.offsetWidth || 340) + 14;
    deck.scrollBy({ left: Number(b.dataset.dir) * step, behavior: S.reduceMotion ? 'auto' : 'smooth' });
  }));

  // ---------- lista completa ----------
  function setList(open) {
    listOpen = open;
    document.body.classList.toggle('list-open', open);
    sheet.inert = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const row = list.querySelector('.store.is-active');
      if (row) row.scrollIntoView({ block: 'center' });
      setTimeout(() => closeBtn.focus({ preventScroll: true }), 50);
    } else if (sheet.contains(document.activeElement)) {
      openBtn.focus({ preventScroll: true });
    }
  }
  openBtn.addEventListener('click', () => setList(true));
  closeBtn.addEventListener('click', () => setList(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && listOpen) setList(false); });

  // deslizar la hoja hacia abajo (desde la cabecera) la cierra
  let dragY = null;
  const head = $('.sheet__head');
  head.addEventListener('touchstart', e => { dragY = e.touches[0].clientY; }, { passive: true });
  head.addEventListener('touchmove', e => {
    if (dragY === null) return;
    const dy = Math.max(0, e.touches[0].clientY - dragY);
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  head.addEventListener('touchend', e => {
    if (dragY === null) return;
    const dy = e.changedTouches[0].clientY - dragY;
    dragY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 90) setList(false);
  });

  // ---------- búsqueda y ubicación ----------
  let timer;
  query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      render();
      view.fit(current(), true);
    }, 160);
  });
  query.addEventListener('keydown', e => { if (e.key === 'Enter') query.blur(); });

  nearBtn.addEventListener('click', () => {
    nearBtn.disabled = true;
    const label = nearBtn.querySelector('span');
    label.textContent = 'Buscando…';
    S.locate(pos => {
      userPos = pos;
      nearBtn.disabled = false;
      label.textContent = 'Cerca de mí';
      render();
      view.showMe(pos);
      const nearest = S.onMap(current())[0];
      if (nearest) select(nearest.id, { fly: true, scrollCard: true });
    }, msg => {
      nearBtn.disabled = false;
      label.textContent = 'Cerca de mí';
      count.textContent = msg;
    });
  });

  // alto de la barra: la lista abre justo debajo
  const setBarH = () => document.documentElement.style.setProperty('--bar-h', `${bar.querySelector('.bar__row').getBoundingClientRect().bottom}px`);
  if ('ResizeObserver' in window) new ResizeObserver(setBarH).observe(bar);
  setBarH();
  window.addEventListener('resize', updateNav);

  render();
})();
