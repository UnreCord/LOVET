// Puntos de venta de Solpet. Coordenadas ubicadas por número de puerta con OpenStreetMap;
// "Cómo llegar" abre Google Maps con el nombre y la dirección, así que lleva a la tienda aunque el pin quede a unas casas.
// [nombre comercial, logo (assets/logos/<logo>.webp), distrito, dirección, lat, lng, también vende online]
// - sin dirección: tienda solo online (sale en la lista, sin pin)
// - con dirección pero sin coordenadas: sale en la lista con "Cómo llegar", sin pin
(function () {
  const WEB = true;
  const FILAS = [
    ['Miushop', 'miushop', 'Santiago de Surco', 'Av. Caminos del Inca 1685', -12.12695, -76.98174, WEB],
    ['Wasi Pet', 'wasi-pet', 'San Miguel', 'Av. Brígida Silva de Ochoa 210', -12.08218, -77.08886],
    ['Royal Pet', 'royal-pet', 'Lince', 'Av. General Trinidad Morán 417', -12.08950, -77.03665],
    ['Brisa Pet Shop', 'brisa', 'Magdalena del Mar', 'Av. Javier Prado Oeste 205', -12.09079, -77.06533, WEB],
    ['Brisa Pet Shop', 'brisa', 'Santiago de Surco', 'Av. Caminos del Inca 848', -12.11917, -76.98852, WEB],
    ['Mundo Pet', 'mundo-pet', 'Magdalena del Mar', 'Jr. Castilla 778', -12.08978, -77.07317],
    ['Veterinaria San Felipe', 'san-felipe', 'Jesús María', 'Av. Faustino Sánchez Carrión 1051', -12.09124, -77.05579, WEB],
    ['Veterinaria San Felipe', 'san-felipe', 'San Miguel', 'Av. De Los Precursores 538', -12.06954, -77.09375, WEB],
    ['Peluvet', null, 'San Miguel', 'Av. Lima 679', -12.08855, -77.08064, WEB],
    ['Veterinaria San Felipe', 'san-felipe', 'Los Olivos', 'Asentamiento San Martín', undefined, undefined, WEB],
    ['Gatuario', 'gatuario', 'San Isidro', 'Calle Baltazar La Torre 1115', -12.10465, -77.05787, WEB],
    ['Gatuario', 'gatuario', 'Santiago de Surco', 'Av. Paseo La Castellana 191', -12.13051, -77.00176, WEB],
    ['+Kotas', 'mas-kotas', 'Breña', 'Jr. Carhuaz 514', -12.05383, -77.04809],
    ['Miau 100% Gatos', '100-miau-gatos', 'Miraflores', 'Calle José Toribio Polo 511', -12.11238, -77.04630, WEB],
    ['Top Can', 'top-can', 'La Victoria', 'Jr. Agustín Gamarra 1133', -12.06986, -77.01266],
    ['Nekohome', 'neko-home', 'Santiago de Surco', 'Jr. Morro Solar 1252', -12.13020, -76.97720],
    ['Monivet', 'monivet', 'Santiago de Surco', 'Calle Loma Ponciana 164', -12.13472, -76.98624, WEB],
    ['T&M Pet Style', 'tm-petshop', 'Lince', 'Av. Coronel José Leal 210', -12.08390, -77.03650, WEB],
    ['T&M Pet Style', 'tm-petshop', 'Santiago de Surco', 'Calle Las Retamas 100', -12.15087, -77.00782, WEB],
    ['Mr. Pet', 'mr-pet', 'La Molina', 'Calle Samoa 328', -12.08304, -76.89805],
    ['Pets Canada', 'pets-canada', 'La Victoria', 'Av. Canadá 1537', -12.08430, -77.00703],
    ['Patmo Pet', 'patmo', 'Tiendas online'],
    ['Animalia Petstore', 'animalia', 'Tiendas online']
  ];

  window.SOLPET_TIENDAS = FILAS.map(([name, logo, district, addr, lat, lng, web], id) => ({
    id, name, district,
    logo: logo ? `../assets/logos/${logo}.webp` : null,
    online: !addr,
    addr: addr || 'Venta online con delivery',
    web: !!web, lat, lng
  }));
})();
