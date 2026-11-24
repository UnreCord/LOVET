// Propuesta 1: mapa + tarjeta con la lista de tiendas (diseño original de "Dónde comprar")
(function () {
  const S = window.Solpet;
  const STORES = window.SOLPET_TIENDAS;
  const $ = s => document.querySelector(s);
  // misma condición que en estilos.css: una sola columna
  const stacked = matchMedia('(max-width: 899px), (max-width: 1023px) and (orientation: portrait)');

  const list = $('#store-list');
  const count = $('#store-count');
  const query = $('#store-q');
  const nearBtn = $('#near-me');
  const card = $('.stores');
  const top = $('.stores__top');
  let selectedId = null, userPos = null, popup = null;

  // espacio libre del mapa (lo que no tapa la tarjeta o la hoja)
  function padding() {
    if (stacked.matches) return { top: 70, bottom: 44, left: 36, right: 36 };
    const r = card.getBoundingClientRect();
    return { top: 60, bottom: 60, left: r.right + 50, right: 70 };
  }

  const view = S.createMap({
    container: 'map',
    stores: STORES,
    cooperative: stacked.matches,   // en celular la página hace scroll: el mapa se mueve con dos dedos
    padding,
    onPin: id => select(id, { fromMap: true }),
    onReady: () => {
      view.fit(current(), false);
      if (selectedId !== null) select(selectedId, { fly: true });
    }
  });

  const current = () => S.filter(STORES, query.value, userPos);

  function render() {
    const items = current();
    count.textContent = S.countText(items, userPos);
    S.renderList(list, items, { selectedId, userPos, query: query.value, onPick: id => select(id, { fly: true }) });
    view.setData(items);
  }

  function select(id, { fly = false, fromMap = false } = {}) {
    selectedId = id;
    const s = STORES[id];
    S.markActive(list, id);
    view.highlight(id);

    const row = list.querySelector(`[data-id="${id}"]`);
    if (stacked.matches) {
      // en celular: si la lista tapa el mapa, se vuelve arriba para verlo
      if (!fromMap && window.scrollY > 4) window.scrollTo({ top: 0, behavior: S.reduceMotion ? 'auto' : 'smooth' });
    } else if (row) {
      const box = list.getBoundingClientRect(), r = row.getBoundingClientRect();
      if (r.top < box.top + 30 || r.bottom > box.bottom) list.scrollBy({ top: r.top - box.top - box.height / 3, behavior: S.reduceMotion ? 'auto' : 'smooth' });
    }

    if (!view.ready) return;
    if (fly) view.focus(s);
    if (popup) popup.remove();
    const box = S.el('div', 'pop');
    const links = S.el('span', 'store__links');
    links.append(S.goLink(s));
    if (s.url) links.append(S.webLink(s));
    box.append(
      S.logo(s),
      S.el('strong', '', s.name),
      S.el('span', '', `${s.addr}, ${s.district}.`),
      links
    );
    popup = new maplibregl.Popup({ offset: [0, -50], maxWidth: '270px', focusAfterOpen: false })
      .setLngLat([s.lng, s.lat]).setDOMContent(box).addTo(view.map);
    popup.on('close', () => {
      if (selectedId === id) { selectedId = null; S.markActive(list, null); view.highlight(null); }
    });
  }

  let timer;
  query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      render();
      view.fit(current(), true);
    }, 160);
  });
  // en celular, "buscar" en el teclado lo cierra para ver los resultados
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
      if (nearest) select(nearest.id, { fly: true });
    }, msg => {
      nearBtn.disabled = false;
      label.textContent = 'Cerca de mí';
      count.textContent = msg;
    });
  });

  // alto de la cabecera fija de la hoja: los títulos de distrito se pegan debajo
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => document.documentElement.style.setProperty('--head-h', `${top.offsetHeight}px`)).observe(top);
  }
  // al girar el celular o cambiar de tamaño, el mapa cambia de modo
  stacked.addEventListener('change', () => {
    if (!view.map) return;
    if (stacked.matches) view.map.cooperativeGestures.enable(); else view.map.cooperativeGestures.disable();
    setTimeout(() => { view.map.resize(); view.fit(current(), false); }, 60);
  });

  render();
})();
