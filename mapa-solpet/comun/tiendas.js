// Puntos de venta de Solpet (tabla DIRECCIONES.xlsx).
// [nombre comercial, logo (assets/logos/<logo>.webp), distrito, dirección, lat, lng, web, ubicación]
// - sin dirección: tienda solo online (sale en la lista con su web, sin pin)
// - con dirección pero sin coordenadas: sale en la lista con "Cómo llegar", sin pin
// - ubicación: 'osm' = el local figura en OpenStreetMap con su número de puerta;
//   'calle' = calculada por número de puerta sobre el trazo de la calle (100 números ≈ una cuadra);
//   sin marcar = ubicada antes por número de puerta con OpenStreetMap.
// "Cómo llegar" abre Google Maps con el nombre y la dirección, así que lleva a la tienda aunque el pin quede a unas casas.
(function () {
  const WEB = {
    miu: 'https://www.adoptamiu.com/',
    brisa: 'https://www.brisapet.pe/',
    patmo: 'https://www.patmopet.pe',
    animalia: 'https://www.animaliastoreperu.com/',
    lumpet: 'https://www.lumpet.pe/',
    miau: 'https://www.miau.pe/',
    peluditos: 'https://www.peluditospet.pe/',
    naricitas: 'https://naricitas.pet/',
    gatuario: 'https://gatuario.com/'
  };
  const FILAS = [
    ['Miu Shop', 'miushop', 'Santiago de Surco', 'Av. Caminos del Inca 1685', -12.12695, -76.98174, WEB.miu],
    ['Animal Wasi Pets', 'wasi-pet', 'San Miguel', 'Av. Brígida Silva de Ochoa 210', -12.08218, -77.08886],
    ['The Urban Pets', null, 'Magdalena del Mar', 'Av. Faustino Sánchez Carrión 479', -12.08881, -77.05980, null, 'calle'],
    ['Veterinaria Royal Pets', 'royal-pet', 'Lince', 'Av. Gral. Trinidad Morán 417', -12.08950, -77.03665],
    ['Brisa Pet Shop', 'brisa', 'Magdalena del Mar', 'Av. Javier Prado Oeste 205', -12.09079, -77.06533, WEB.brisa],
    ['Brisa Pet Shop', 'brisa', 'Santiago de Surco', 'Av. Caminos del Inca 848', -12.11917, -76.98852, WEB.brisa],
    ['Mundo Love Pet', 'mundo-pet', 'Magdalena del Mar', 'Jirón Castilla 778', -12.08978, -77.07317],
    ['Veterinaria San Felipe', 'san-felipe', 'Jesús María', 'Av. Faustino Sánchez Carrión 1051', -12.09124, -77.05579],
    ['Veterinaria San Felipe', 'san-felipe', 'San Miguel', 'Av. De Los Precursores 538', -12.06954, -77.09375],
    ['Peluvet Spa', null, 'San Miguel', 'Av. Lima 679', -12.08855, -77.08064],
    ['Veterinaria San Felipe', 'san-felipe', 'Los Olivos', 'Asentamiento San Martín'],
    ['American Vet', null, 'San Borja', 'Av. San Luis 2845', -12.09143, -76.99590, null, 'calle'],
    ['American Vet', null, 'Barranco', 'Av. República de Panamá 6584', -12.13199, -77.01824, null, 'osm'],
    ['+KOTAS Pet Shop', 'mas-kotas', 'Breña', 'Jirón Carhuaz 514', -12.05383, -77.04809],
    ['Lumpet Pet Shop', null, 'La Victoria', 'Av. Canadá 1238', -12.08466, -77.01097, WEB.lumpet, 'calle'],
    ['Miau 100% Gatos', '100-miau-gatos', 'Miraflores', 'Calle José Toribio Polo 511', -12.11238, -77.04630, WEB.miau],
    ['Peluditos Pet Shop', null, 'Pueblo Libre', 'Av. Manuel Cipriano Dulanto 1668', -12.07644, -77.07358, WEB.peluditos, 'calle'],
    ['Peluditos Pet Shop', null, 'Surquillo', 'Av. Manuel Villarán 770', -12.12128, -77.00415, WEB.peluditos, 'osm'],
    // "Av. Central 993, Lima": OpenStreetMap no encuentra una Av. Central en el Cercado; falta confirmar el distrito
    ['Peluditos Pet Shop', null, 'Lima', 'Av. Central 993', undefined, undefined, WEB.peluditos],
    ['Neko Home', 'neko-home', 'Santiago de Surco', 'Jr. Morro Solar 1252', -12.13020, -76.97720],
    ['Naricitas Pet Shop', null, 'Magdalena del Mar', 'Jirón Castilla 690', -12.08931, -77.07313, WEB.naricitas, 'calle'],
    ['Naricitas Pet Shop', null, 'Magdalena del Mar', 'Jirón Castilla 811', -12.09026, -77.07347, WEB.naricitas, 'calle'],
    ['Pals & Tails Pet Shop', null, 'Miraflores', 'Av. 28 de Julio 106', -12.12598, -77.03176, null, 'calle'],
    ['T&M Pet Style', 'tm-petshop', 'Lince', 'Av. Coronel José Leal 210', -12.08390, -77.03650],
    ['T&M Pet Style', 'tm-petshop', 'Santiago de Surco', 'Calle Las Retamas 100', -12.15087, -77.00782],
    ['T&M Pet Style', 'tm-petshop', 'Magdalena del Mar', 'Jirón Yungay 762', -12.08953, -77.07547, null, 'calle'],
    ['T&M Pet Style', 'tm-petshop', 'La Victoria', 'Calle Juan Castro 187, Urb. Balconcillo', -12.07532, -77.02080, null, 'calle'],
    ['Mr. Pet', 'mr-pet', 'La Molina', 'Calle Samoa 328', -12.08304, -76.89805],
    ['Gatuario', 'gatuario', 'San Isidro', 'Calle Baltazar La Torre 1115', -12.10465, -77.05787, WEB.gatuario],
    ['Gatuario', 'gatuario', 'Santiago de Surco', 'Av. Paseo La Castellana 191', -12.13051, -77.00176, WEB.gatuario],
    ['Top Can', 'top-can', 'La Victoria', 'Jr. Agustín Gamarra 1133', -12.06986, -77.01266],
    ['Monivet Center', 'monivet', 'Santiago de Surco', 'Calle Loma Ponciana 164', -12.13472, -76.98624],
    ['Veterinaria Pets Canadá', 'pets-canada', 'La Victoria', 'Av. Canadá 1537', -12.08430, -77.00703],
    // dirección sin número de puerta (Mza./Lote) y con la urbanización incompleta: sin pin
    ['Veterinaria Mundo Animal', null, 'Chorrillos', 'Av. Alameda Los Horizontes Mza. A1 Lote 15'],
    ['Veterinaria Engreídos', null, 'Santiago de Surco', 'Jr. Lomas de las Azucenas 263', -12.14240, -76.98677, null, 'calle'],
    ['Patmo Pets', 'patmo', 'Tiendas online', null, undefined, undefined, WEB.patmo],
    ['Animalia Pet Store', 'animalia', 'Tiendas online', null, undefined, undefined, WEB.animalia]
  ];

  window.SOLPET_TIENDAS = FILAS.map(([name, logo, district, addr, lat, lng, url, ubicacion], id) => ({
    id, name, district,
    logo: logo ? `../assets/logos/${logo}.webp` : null,
    online: !addr,
    addr: addr || 'Venta online con delivery',
    url: url || null, lat, lng,
    approx: ubicacion === 'calle'
  }));
})();
