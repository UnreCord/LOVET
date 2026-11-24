// Mapa de puntos de venta Solpet: piezas comunes a las dos propuestas
// (filtro, lista agrupada por distrito, mapa base con los colores de Solpet y pines).
(function () {
  const VERDE = '#007A33';
  const AMARILLO = '#F6BB2F';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const decimal = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  const onMap = list => list.filter(s => s.lat !== undefined);
  const ONLINE = 'Tiendas online';

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const directionsUrl = s =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.name}, ${s.addr}, ${s.district}, Lima, Perú`)}`;

  function distanceKm(a, b) {
    const rad = x => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  const distanceText = km => (km < 1 ? `a ${Math.round(km * 100) * 10} m` : `a ${decimal(Math.round(km * 10) / 10)} km`);

  // tiendas que coinciden con la búsqueda; con ubicación, de la más cercana a la más lejana
  function filter(stores, query, userPos) {
    const q = normalize(query || '');
    let list = stores.filter(s => !q || normalize(`${s.name} ${s.district} ${s.addr}${s.url ? ' online web' : ''}`).includes(q));
    if (userPos) {
      list = list
        .map(s => (s.lat === undefined ? s : { ...s, km: distanceKm(userPos, s) }))
        .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    }
    return list;
  }

  function countText(list, userPos) {
    if (!list.length) return '';
    const shops = list.filter(s => !s.online), online = list.length - shops.length;
    const districts = new Set(shops.map(s => s.district)).size;
    return [
      shops.length ? `${plural(shops.length, 'punto de venta', 'puntos de venta')} en ${plural(districts, 'distrito', 'distritos')}` : '',
      online ? plural(online, 'tienda online', 'tiendas online') : ''
    ].filter(Boolean).join(' y ') + (userPos && shops.length ? ', del más cercano al más lejano.' : '.');
  }

  // logo de la tienda; si aún no tenemos su logo, sus iniciales
  function logo(s, cls = 'store__logo') {
    const box = el('span', cls);
    if (s.logo) {
      const img = el('img');
      img.src = s.logo;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = img.height = 240;
      box.appendChild(img);
    } else {
      box.classList.add('store__logo--initials');
      box.textContent = s.name.split(' ').slice(0, 2).map(w => w[0]).join('');
    }
    return box;
  }

  function goLink(s, text = 'Cómo llegar', cls = 'store__go') {
    const go = el('a', cls, text);
    go.href = directionsUrl(s);
    go.target = '_blank';
    go.rel = 'noopener';
    go.setAttribute('aria-label', `Cómo llegar a ${s.name}, ${s.addr}, ${s.district} (abre Google Maps)`);
    return go;
  }

  // web de la tienda (las que venden online)
  function webLink(s, text = 'Tienda online', cls = 'store__web') {
    const a = el('a', cls, text);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', `Tienda online de ${s.name} (abre su web)`);
    return a;
  }

  // lista agrupada por distrito (el mismo diseño de la sección "Dónde comprar")
  function renderList(box, list, { selectedId = null, userPos = null, query = '', onPick } = {}) {
    box.innerHTML = '';
    const districts = [...new Set(list.map(s => s.district))];
    if (!userPos) districts.sort((a, b) => a.localeCompare(b, 'es'));
    // las tiendas online van al final
    if (districts.includes(ONLINE)) districts.push(districts.splice(districts.indexOf(ONLINE), 1)[0]);

    if (!list.length) {
      box.appendChild(el('p', 'stores__empty', `No encontramos puntos de venta para “${query.trim()}”. Prueba con otro distrito o tienda.`));
      return;
    }
    districts.forEach(d => {
      const items = list.filter(s => s.district === d);
      const group = el('section', 'stores__group');
      const head = el('h3', 'stores__district', d);
      head.appendChild(el('span', '', String(items.length)));
      group.appendChild(head);
      const ul = el('ul', 'stores__items');
      items.forEach(s => {
        const row = el('li', 'store');
        row.dataset.id = s.id;
        if (s.id === selectedId) row.classList.add('is-active');
        const pick = el('button', 'store__pick');
        pick.type = 'button';
        pick.appendChild(el('span', 'store__name', s.name));
        pick.appendChild(el('span', 'store__addr', s.addr));
        if (s.km !== undefined) pick.appendChild(el('span', 'store__dist', distanceText(s.km)));
        const links = el('span', 'store__links');
        row.append(logo(s), pick, links);
        if (!s.online) links.append(goLink(s));
        if (s.url) links.append(webLink(s, s.online ? 'Visitar tienda' : 'Tienda online'));
        if (s.online) {
          row.classList.add('store--online');
          pick.disabled = true;
        } else if (s.lat === undefined) {
          row.classList.add('store--nopin');
          pick.disabled = true;
        } else {
          pick.setAttribute('aria-label', `${s.name}, ${s.addr}, ${s.district}. Ver en el mapa`);
          row.addEventListener('click', e => {
            if (e.target.closest('a')) return;
            onPick && onPick(s.id);
          });
        }
        ul.appendChild(row);
      });
      group.appendChild(ul);
      box.appendChild(group);
    });
  }

  function markActive(box, id) {
    box.querySelectorAll('.store').forEach(row => row.classList.toggle('is-active', Number(row.dataset.id) === id));
  }

  // recolorea el mapa base (positron) con la paleta de Solpet
  function brandMap(map) {
    const style = map.getStyle();
    for (const l of style.layers) {
      const sl = l['source-layer'] || '', id = l.id;
      try {
        if (l.type === 'background') map.setPaintProperty(id, 'background-color', '#eff3ee');
        else if (l.type === 'fill') {
          let c = null;
          if (sl === 'water') c = '#c6dfe0';
          else if (sl === 'park' || /park|wood|grass|forest/.test(id)) c = '#d9ead9';
          else if (sl === 'building') c = '#e2e7e0';
          else if (sl === 'landuse' || sl === 'landcover') c = '#e8ede6';
          if (c) map.setPaintProperty(id, 'fill-color', c);
        } else if (l.type === 'line') {
          let c = null;
          if (sl === 'transportation') {
            if (/rail/.test(id)) c = '#c9d1c7';
            else if (/casing/.test(id)) c = /motorway/.test(id) ? '#eedcae' : '#dbe1d8';
            else c = /motorway/.test(id) ? '#fbecc6' : '#ffffff';
          } else if (sl === 'waterway') c = '#c6dfe0';
          else if (sl === 'boundary') c = '#9db6a6';
          if (c) map.setPaintProperty(id, 'line-color', c);
        } else if (l.type === 'symbol' && l.layout && l.layout['text-field']) {
          map.setPaintProperty(id, 'text-color', sl === 'place' ? '#005a26' : '#6b6f66');
          map.setPaintProperty(id, 'text-halo-color', '#eff3ee');
          // nombres en español (el estilo base prefiere el nombre en inglés)
          if (JSON.stringify(l.layout['text-field']).includes('name_en')) {
            map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name_en']]);
          }
        }
      } catch (err) { /* capa sin esa propiedad */ }
    }
    // límites de distrito punteados
    const vector = Object.keys(style.sources).find(k => style.sources[k].type === 'vector');
    const firstSymbol = style.layers.find(l => l.type === 'symbol');
    if (vector) {
      map.addLayer({
        id: 'solpet-districts', type: 'line', source: vector, 'source-layer': 'boundary',
        filter: ['==', ['get', 'admin_level'], 8],
        paint: { 'line-color': VERDE, 'line-opacity': 0.45, 'line-width': 1.3, 'line-dasharray': [3, 2] }
      }, firstSymbol && firstSymbol.id);
    }
  }

  function toGeoJSON(list) {
    return {
      type: 'FeatureCollection',
      features: onMap(list).map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { id: s.id } }))
    };
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Crea el mapa con los pines de las tiendas.
   * opts: container, stores, cooperative (dos dedos para mover), padding() -> {top,right,bottom,left},
   *       onPin(id) al tocar un pin.
   */
  function createMap(opts) {
    const api = { map: null, ready: false, selectedId: null };
    const container = typeof opts.container === 'string' ? document.getElementById(opts.container) : opts.container;
    if (!window.maplibregl) {
      container.appendChild(el('p', 'map__fallback', 'No pudimos cargar el mapa. Revisa tu conexión: la lista de puntos de venta sigue disponible.'));
      api.setData = api.highlight = api.focus = api.fit = api.showMe = () => {};
      return api;
    }
    const pad = () => (opts.padding ? opts.padding() : { top: 60, bottom: 60, left: 40, right: 40 });
    const map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-77.03, -12.1],
      zoom: 11.6,
      attributionControl: { compact: true },
      cooperativeGestures: !!opts.cooperative,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda del mouse para acercar el mapa',
        'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda del mouse para acercar el mapa',
        'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
        'NavigationControl.ZoomIn': 'Acercar',
        'NavigationControl.ZoomOut': 'Alejar'
      }
    });
    map.touchZoomRotate.disableRotation();
    api.map = map;
    if (opts.controls !== false) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), opts.controlsPosition || 'bottom-right');

    let pending = toGeoJSON(opts.stores);
    let meMarker = null;

    api.setData = list => {
      pending = toGeoJSON(list);
      if (api.ready) map.getSource('stores').setData(pending);
    };

    api.highlight = id => {
      api.selectedId = id;
      if (!api.ready) return;
      const on = id === null ? false : ['==', ['get', 'id'], id];
      map.setLayoutProperty('store-points', 'icon-image', on ? ['case', on, 'solpet-pin-on', 'solpet-pin'] : 'solpet-pin');
      map.setLayoutProperty('store-points', 'symbol-sort-key', on ? ['case', on, 1, 0] : 0);
    };

    // centra una tienda dejando libre el espacio que tapan los paneles
    api.focus = (s, { zoom = 14.6, duration = 900 } = {}) => {
      if (!api.ready || s.lat === undefined) return;
      map.easeTo({
        center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), zoom), padding: pad(),
        duration: reduceMotion ? 0 : duration, essential: true
      });
    };

    api.fit = (list, animate) => {
      if (!api.ready) return;
      const pts = onMap(list);
      if (!pts.length) return;
      const bounds = new maplibregl.LngLatBounds();
      pts.forEach(s => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: pad(), maxZoom: 14.5, duration: animate && !reduceMotion ? 700 : 0 });
    };

    api.showMe = pos => {
      if (!api.ready) return;
      if (!meMarker) {
        const dot = el('span', 'me-dot');
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', 'Tu ubicación');
        meMarker = new maplibregl.Marker({ element: dot });
      }
      meMarker.setLngLat([pos.lng, pos.lat]).addTo(map);
    };

    map.on('load', async () => {
      brandMap(map);
      const [pin, pinOn] = await Promise.all([loadImage('../assets/pin.png'), loadImage('../assets/pin-activo.png')]);
      map.addImage('solpet-pin', pin, { pixelRatio: 2 });
      map.addImage('solpet-pin-on', pinOn, { pixelRatio: 2 });
      map.addSource('stores', { type: 'geojson', data: pending, cluster: true, clusterRadius: 38, clusterMaxZoom: 13 });
      map.addLayer({
        id: 'store-clusters', type: 'circle', source: 'stores', filter: ['has', 'point_count'],
        paint: {
          'circle-color': VERDE, 'circle-radius': ['step', ['get', 'point_count'], 17, 4, 21],
          'circle-stroke-color': AMARILLO, 'circle-stroke-width': 3
        }
      });
      map.addLayer({
        id: 'store-count', type: 'symbol', source: 'stores', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': true },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'store-points', type: 'symbol', source: 'stores', filter: ['!', ['has', 'point_count']],
        layout: { 'icon-image': 'solpet-pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'symbol-sort-key': 0 }
      });

      map.on('click', 'store-points', e => opts.onPin && opts.onPin(Number(e.features[0].properties.id)));
      map.on('click', 'store-clusters', async e => {
        const f = e.features[0];
        const zoom = await map.getSource('stores').getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.4, padding: pad(), duration: reduceMotion ? 0 : 600 });
      });
      ['store-points', 'store-clusters'].forEach(id => {
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      });

      api.ready = true;
      if (api.selectedId !== null) api.highlight(api.selectedId);
      opts.onReady && opts.onReady();
    });
    return api;
  }

  // ubicación del visitante
  function locate(ok, fail) {
    if (!navigator.geolocation) {
      fail('Tu navegador no comparte la ubicación. Busca por distrito o tienda.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => ok({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => fail('No pudimos ver tu ubicación. Revisa el permiso del navegador o busca por distrito.'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }

  window.Solpet = {
    reduceMotion, normalize, plural, el, onMap, directionsUrl, distanceText,
    filter, countText, logo, goLink, webLink, renderList, markActive, createMap, locate
  };
})();
