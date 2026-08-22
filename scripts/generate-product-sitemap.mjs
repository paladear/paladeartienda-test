import { readFile, writeFile } from 'node:fs/promises';

const BASE_URL = 'https://paladear.github.io/paladeartienda/';
const CALLBACK = 'recibirPrecios';
const PRICES_URL = 'https://script.google.com/macros/s/AKfycbwpRm16QpdpCNTtRwtmoZsNPesqA3Vfli2LEubvunNiV0lFTH-rKPLNaIpsm531F3c9/exec?callback=' + CALLBACK;
const INFO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2RlZaSdlV-aaVGUw7YI9MVE1MHjopNhbjTOfWBZwPNo_clhJUao2KNcNowEzsdBGpd2Bh5-2rt1aH/pub?gid=1603230501&single=true&output=csv';

const VALID_RUBROS = new Set([
  'FRUTOS SECOS', 'DESHIDRATADOS', 'SEMILLAS', 'ESPECIAS',
  'INFUSIONES Y HIERBAS', 'CEREALES', 'GRANOS Y LEGUMBRES', 'HARINAS',
  'PRODUCTOS SIN TACC', 'DULCES, MIEL Y CHOCOLATES',
  'AZUCAR, CACAO Y REPOSTERIA', 'MANTECAS Y PASTAS',
  'ACEITES Y VINAGRES', 'ACEITUNAS', 'ENCURTIDOS', 'TOMATE TRITURADO',
  'SNACK', 'SUPLEMENTOS', 'LINEA GOURMET', 'BEBIDAS', 'VINOS',
  'PRODUCTOS DE FRIO', 'PRODUCTOS CONGELADOS', 'PALADEAR HOME'
]);

function parseCsv(csv) {
  const rows = [];
  const lines = csv.trim().split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    let raw = lines[i++];
    let quoteCount = (raw.match(/"/g) || []).length;
    while (quoteCount % 2 !== 0 && i < lines.length) {
      raw += '\n' + lines[i++];
      quoteCount = (raw.match(/"/g) || []).length;
    }
    const cols = [];
    let current = '';
    let quoted = false;
    for (let j = 0; j < raw.length; j++) {
      const char = raw[j];
      if (char === '"') {
        if (quoted && raw[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function slug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function cleanId(value) {
  return String(value || '').trim().replace(/\./g, '').replace(/,.*$/, '');
}

function price(value) {
  const clean = String(value || '').replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number.parseFloat(clean);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function unescapeXml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'PaladearSitemap/1.0' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error('No se pudo descargar el catálogo: ' + lastError.message);
}

function unwrapJsonp(payload) {
  const start = payload.indexOf(CALLBACK + '(');
  const end = payload.lastIndexOf(')');
  if (start < 0 || end <= start) throw new Error('La respuesta del catálogo no tiene el formato JSONP esperado');
  const csv = JSON.parse(payload.slice(start + CALLBACK.length + 1, end));
  if (typeof csv !== 'string' || !csv.includes('Nombre') || !csv.includes('Artículo')) {
    throw new Error('El catálogo descargado no contiene las columnas esperadas');
  }
  return csv;
}

function buildProducts(pricesCsv, infoCsv) {
  const infoRows = parseCsv(infoCsv);
  if (!infoRows.length || normalize(infoRows[0][0]) !== 'NOMBRE') {
    throw new Error('info-min.csv no tiene un encabezado válido');
  }

  const infoById = new Map();
  const infoByName = new Map();
  for (const cols of infoRows.slice(1)) {
    const name = String(cols[0] || '').trim();
    const id = cleanId(cols[6]);
    if (!name) continue;
    if (id) infoById.set(id, name);
    infoByName.set(normalize(name), name);
  }

  const priceRows = parseCsv(pricesCsv);
  const productsById = new Map();
  let skippedWithoutId = 0;
  for (const cols of priceRows.slice(1)) {
    const sourceName = String(cols[2] || '').trim();
    const regularPrice = price(cols[3]);
    const discountPrice = price(cols[4]);
    const rubro = normalize(cols[5]);
    const id = cleanId(cols[6]);
    if (!sourceName || !regularPrice || !discountPrice || !VALID_RUBROS.has(rubro)) continue;
    if (!id) {
      skippedWithoutId++;
      continue;
    }
    const name = infoById.get(id) || infoByName.get(normalize(sourceName)) || sourceName;
    const productSlug = slug(name) + '-' + slug(id);
    if (!slug(name) || !slug(id)) continue;
    productsById.set(id, {
      id,
      name,
      url: BASE_URL + '?producto=' + encodeURIComponent(productSlug)
    });
  }

  const products = [...productsById.values()].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  if (products.length < 50) throw new Error('Se encontraron solo ' + products.length + ' productos; se canceló para proteger el sitemap existente');
  return { products, skippedWithoutId };
}

function currentStaticEntries(xml) {
  const entries = [...xml.matchAll(/<url\b[^>]*>[\s\S]*?<\/url>/gi)]
    .map(match => match[0].trim())
    .filter(entry => !/[?&](?:amp;)?producto=/.test(entry));
  if (entries.length < 2) throw new Error('No se pudieron conservar las URLs de portada y categorías');
  return entries;
}

function locFromEntry(entry) {
  const match = entry.match(/<loc>([\s\S]*?)<\/loc>/i);
  return match ? unescapeXml(match[1].trim()) : '';
}

const [jsonp, infoResponse, currentSitemap] = await Promise.all([
  fetchWithRetry(PRICES_URL + '&t=' + Date.now()),
  fetchWithRetry(INFO_URL + '&t=' + Date.now()),
  readFile('sitemap.xml', 'utf8')
]);

const pricesCsv = unwrapJsonp(jsonp).replace(/\r\n?/g, '\n');
const infoCsv = infoResponse.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
const { products, skippedWithoutId } = buildProducts(pricesCsv, infoCsv);
const staticEntries = currentStaticEntries(currentSitemap);
const productEntries = products.map(product =>
  '  <url>\n    <loc>' + escapeXml(product.url) + '</loc>\n  </url>'
);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticEntries.map(entry => '  ' + entry),
  ...productEntries,
  '</urlset>',
  ''
].join('\n');

const textUrls = [
  ...staticEntries.map(locFromEntry).filter(Boolean),
  ...products.map(product => product.url)
];

await Promise.all([
  writeFile('precios-min.csv', pricesCsv.endsWith('\n') ? pricesCsv : pricesCsv + '\n'),
  writeFile('info-min.csv', infoCsv.endsWith('\n') ? infoCsv : infoCsv + '\n'),
  writeFile('sitemap.xml', sitemap),
  writeFile('sitemap.txt', textUrls.join('\n') + '\n')
]);

console.log('Sitemap generado: ' + staticEntries.length + ' páginas/categorías + ' + products.length + ' productos.');
if (skippedWithoutId) console.log('Productos omitidos por no tener ID estable: ' + skippedWithoutId + '.');
