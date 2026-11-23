// Genera una página real por producto y por rubro, para que Google (y WhatsApp)
// vean el contenido en el HTML y no sólo después de ejecutar JavaScript.
// NO toca precios-min.csv ni catalogo-panel.json: sólo los lee.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://paladear.com.ar/';
const TIENDA = 'Paladear Mercado de Sabores';
const SALIDA = process.env.SALIDA || '.';

const VALID_RUBROS = new Map([
  ['FRUTOS SECOS','Frutos Secos'],['DESHIDRATADOS','Deshidratados'],['SEMILLAS','Semillas'],
  ['ESPECIAS','Especias'],['INFUSIONES Y HIERBAS','Infusiones y Hierbas'],['CEREALES','Cereales'],
  ['GRANOS Y LEGUMBRES','Granos y Legumbres'],['HARINAS','Harinas'],['PRODUCTOS SIN TACC','Sin TACC'],
  ['DULCES, MIEL Y CHOCOLATES','Dulces, Miel y Chocolates'],['AZUCAR, CACAO Y REPOSTERIA','Azúcar, Cacao y Repostería'],
  ['MANTECAS Y PASTAS','Mantecas y Pastas'],['ACEITES Y VINAGRES','Aceites y Vinagres'],['ACEITUNAS','Aceitunas'],
  ['ENCURTIDOS','Encurtidos'],['TOMATE TRITURADO','Tomate'],['SNACK','Snacks'],['SUPLEMENTOS','Suplementos'],
  ['LINEA GOURMET','Línea Gourmet'],['BEBIDAS','Bebidas'],['VINOS','Vinos y Licores'],
  ['PRODUCTOS DE FRIO','Productos de Frío'],['PRODUCTOS CONGELADOS','Congelados'],['PALADEAR HOME','Paladear Home']
]);

function parseCsv(csv){
  const rows=[]; const lines=csv.trim().split(/\r?\n/); let i=0;
  while(i<lines.length){
    let raw=lines[i++]; let q=(raw.match(/"/g)||[]).length;
    while(q%2!==0 && i<lines.length){ raw+='\n'+lines[i++]; q=(raw.match(/"/g)||[]).length; }
    const cols=[]; let cur=''; let quoted=false;
    for(let j=0;j<raw.length;j++){
      const ch=raw[j];
      if(ch==='"'){ if(quoted&&raw[j+1]==='"'){cur+='"';j++;} else quoted=!quoted; }
      else if(ch===','&&!quoted){ cols.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    cols.push(cur.trim()); rows.push(cols);
  }
  return rows;
}
const norm = v => String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim();
const slug = v => String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
const cleanId = v => String(v||'').trim().replace(/\./g,'').replace(/,.*$/,'');
function price(v){
  const c=String(v||'').replace(/[^0-9,.]/g,'').replace(/\./g,'').replace(',','.');
  const n=Number.parseFloat(c); return Number.isFinite(n)?Math.round(n):0;
}
const esc = v => String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt = n => new Intl.NumberFormat('es-AR').format(Math.round(n||0));
// "100G" y "1KG" como los escribe la tienda: "100 g", "1 kg".
const medida = v => String(v||'').trim().replace(/^(\d+)\s*(kg|gr|g)$/i,
  (m,n,u)=>n+' '+(u.toLowerCase()==='kg'?'kg':'g'));
// Corta sin partir palabras, para la descripción que ve Google.
function recorte(t,max){
  t=String(t||'').replace(/\s+/g,' ').trim();
  if(t.length<=max) return t;
  const corte=t.slice(0,max-1);
  return corte.slice(0,corte.lastIndexOf(' ')).replace(/[,;:.\s]+$/,'')+'…';
}

function optsDe(cantidades){
  const t=String(cantidades||'').trim();
  if(!t) return null;
  const partes=t.split('/').map(x=>x.trim()).filter(Boolean);
  if(!partes.length) return null;
  const gram = partes.every(p=>/^\d+\s*(g|gr|kg)$/i.test(p));
  if(!gram) return {granel:false, labels:partes};
  const g = p => { const m=p.match(/^(\d+)\s*(g|gr|kg)$/i); if(!m) return 0;
    return /kg/i.test(m[2]) ? Number(m[1])*1000 : Number(m[1]); };
  return {granel:true, labels:partes, gramos:partes.map(g)};
}

function buildProducts(pricesCsv, fichas){
  const rows=parseCsv(pricesCsv);
  const porId=new Map();
  for(const cols of rows.slice(1)){
    const nombreCsv=String(cols[2]||'').trim();
    const p1=price(cols[3]), p2=price(cols[4]);
    const rubroKey=norm(cols[5]);
    const id=cleanId(cols[6]);
    if(!nombreCsv||!p1||!p2||!VALID_RUBROS.has(rubroKey)||!id) continue;
    const fi=fichas[id]||{};
    if(fi.oculto===true) continue;
    const nombre=String(fi.nombre||nombreCsv).trim();
    const sl=slug(nombre)+'-'+slug(id);
    if(!slug(nombre)||!slug(id)) continue;
    const o=optsDe(fi.cantidades);
    const ofertaPct=Number(fi.oferta||0)||0;
    const conOferta = p => ofertaPct>0 ? Math.round(p*(1-ofertaPct/100)) : p;
    let desde, hasta;
    if(o && o.granel){
      const gs=o.gramos.filter(x=>x>0).sort((a,b)=>a-b);
      desde = conOferta(Math.round(p1*(gs[0]/1000)));
      hasta = conOferta(Math.round(p1*(gs[gs.length-1]/1000)));
    } else { desde = hasta = conOferta(p1); }
    porId.set(id,{
      id, nombre, slug:sl, rubroKey,
      rubro: VALID_RUBROS.get(rubroKey), rubroSlug: slug(VALID_RUBROS.get(rubroKey)),
      desc: String(fi.desc||'').trim(),
      marca: String(fi.marca||'').trim(),
      envase: String(fi.envase||'').trim(),
      granel: !!(o&&o.granel), labels:(o&&o.labels)||[],
      gramos: (o&&o.granel) ? o.gramos : [],
      precioKg: p1, precioLista: p1, precioMay: p2,
      desdeMay: (o&&o.granel) ? Math.round(p2*(o.gramos.filter(x=>x>0).sort((a,b)=>a-b)[0]/1000)) : p2,
      gramoMin: (o&&o.granel) ? o.gramos.filter(x=>x>0).sort((a,b)=>a-b)[0] : 0,
      desde, hasta, ofertaPct,
      url: BASE+'p/'+sl+'/'
    });
  }
  return [...porId.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}));
}

/* El estilo NO se escribe acá: se saca del propio index.html, de las mismas
   reglas que pinta la ficha abierta de la tienda. Así la página del producto
   se ve igual que la tienda y no se desincroniza cuando cambie el diseño. */
const PREFIJOS = ['.product-detail','.pdrel-','.opt-btn','.prices','.price-min','.price-may',
  '.price-label','.price-unit','.add-btn','.add-cart-icon','.nom-p','.nom-c','.nom-m','.nom-meta',
  '.precio-oferta','.precio-tachado','.product-image-placeholder','.opt-btns','.sello-d'];
function cssDeLaTienda(html){
  const bloques=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
  const raiz=(bloques.match(/:root\{[^}]*\}/)||[''])[0];
  const reglas=[];
  const re=/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}|[^{}]+\{[^{}]*\}/g;
  let m;
  while((m=re.exec(bloques))){
    const t=m[0];
    const sel=t.trimStart().startsWith('@media') ? t : t.split('{')[0];
    if(PREFIJOS.some(p=>sel.includes(p))) reglas.push(t);
  }
  if(reglas.length<40) throw new Error('Sólo se extrajeron '+reglas.length+' reglas de index.html; se cancela para no publicar páginas sin estilo');
  return raiz + '\n' + reglas.join('\n') + `
/* Reset base de la tienda. Sin esto el padding se suma al 100% del ancho y la
   foto del producto queda más grande que su caja y se recorta. */
*{margin:0;padding:0;box-sizing:border-box;font-family:'Montserrat',sans-serif}
button{cursor:pointer;border:none;font-family:inherit}
img{max-width:100%}
/* Ajustes para que la misma ficha funcione como página suelta y no como capa. */
html,body{margin:0;background:#f8f5ef}
body{font-family:'Montserrat',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--fg);line-height:1.5}
.product-detail{position:static!important;inset:auto!important;z-index:auto!important;min-height:100vh;animation:none}
.product-detail-bar{position:sticky;top:0}
.product-detail-bar a{text-decoration:none}
.product-detail-title{margin-top:0}
.product-detail-buy .add-btn{text-decoration:none;margin-top:4px}
.pdrel-card{text-decoration:none}
.pdrel-img img{max-width:100%;max-height:100%;object-fit:contain}
.pd-pie{margin:34px 0 0;padding:18px 0 40px;text-align:center;font-size:12.5px;color:#6b8aa1}
.pd-rubro-intro{margin:0 0 18px;color:#496579;font-size:14.5px}
`;
}

const ICONO_CARRITO = '<span class="add-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l2.4 10.3a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/></svg></span>';
const FLECHA = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

function pagina({title, desc, canonical, image, body, schema}){
  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Paladear">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${image?`<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">`:'<meta name="twitter:card" content="summary">'}
<meta property="og:locale" content="es_AR">
<link rel="icon" href="${BASE}favicon-32x32.png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BASE}ficha-producto.css">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="min-redesign">
${body}
</body>
</html>
`;
}

// Barra de arriba: la misma de la ficha abierta, pero con links de verdad.
function barra(volverA){
  return `<div class="product-detail-bar">
    <a class="product-detail-back" href="${esc(volverA)}" aria-label="Volver">${FLECHA}</a>
    <strong>Detalle del producto</strong>
    <a class="product-detail-close" href="${BASE}" aria-label="Ir a la tienda">×</a>
  </div>`;
}

function miniCard(q){
  const img = q.tieneFoto ? BASE+'fotos/'+q.id+'.webp' : '';
  return `<a class="pdrel-card" href="${BASE}p/${esc(q.slug)}/">`
    + `<span class="pdrel-img">${img?`<img src="${esc(img)}" alt="${esc(q.nombre)}" loading="lazy" decoding="async" width="200" height="200">`:'<span class="product-image-placeholder" aria-hidden="true"></span>'}</span>`
    + `<span class="pdrel-nom"><b class="nom-p">${esc(q.nombre)}</b>${q.marca?`<span class="nom-meta"><em class="nom-m">${esc(q.marca)}</em></span>`:''}</span>`
    + `<span class="pdrel-precio">${q.granel?'desde ':''}$${fmt(q.desde)}</span>`
    + `</a>`;
}

function paginaProducto(p, hermanos, hayFoto){
  const img = hayFoto ? BASE+'fotos/'+p.id+'.webp' : '';
  const titulo = p.nombre + (p.marca?' '+p.marca:'') + ' | Paladear Mendoza';
  const descMeta = recorte(p.desc || (p.nombre+(p.marca?' de '+p.marca:'')+'. Comprá online en Paladear, dietética en Mendoza con envíos a todo el país.'), 158);
  // Las medidas se pintan como en la tienda: de menor a mayor y con la mayor
  // elegida, que es la que la tienda trae puesta.
  const vis = p.labels.slice();
  const act = vis.length-1;
  const precioDe = i => {
    if(!p.granel) return {min:p.desde, may:p.desdeMay};
    const g = p.gramos[i]||0;
    const f = g/1000;
    const ap = v => p.ofertaPct>0 ? Math.round(v*(1-p.ofertaPct/100)) : v;
    return {min: ap(Math.round(p.precioLista*f)), may: Math.round(p.precioMay*f)};
  };
  const pr = precioDe(act);
  const opciones = vis.length>1 ? `<h3>Elegí la presentación</h3><div class="product-detail-options opt-btns${vis.length>=4?' opt-btns-4':''}">`
      + vis.map((l,i)=>{const q=precioDe(i); return `<button type="button" class="opt-btn${i===act?' active':''}" data-min="${q.min}" data-may="${q.may}" data-medida="${esc(l)}">${esc(medida(l))}</button>`;}).join('')
      + `</div>` : '';
  const metaFila = (p.marca || (p.envase && !p.granel))
    ? `<div class="product-detail-meta">${(p.envase&&!p.granel)?`<span class="nom-c">${esc(p.envase)}</span>`:''}${p.marca?`<em class="nom-m">${esc(p.marca)}</em>`:''}</div>` : '';
  const precioMinHTML = p.ofertaPct>0
    ? `<span class="precio-tachado">$${fmt(p.granel?Math.round(p.precioLista*((p.gramos[act]||1000)/1000)):p.precioLista)}</span> <span class="precio-oferta">$${fmt(pr.min)}</span>`
    : `$${fmt(pr.min)}`;

  const offers = p.granel
    ? {"@type":"AggregateOffer","priceCurrency":"ARS","lowPrice":p.desde,"highPrice":p.hasta,
       "offerCount":p.labels.length,"availability":"https://schema.org/InStock","url":p.url}
    : {"@type":"Offer","priceCurrency":"ARS","price":p.desde,
       "availability":"https://schema.org/InStock","url":p.url};
  const schema = {"@context":"https://schema.org","@graph":[
    {"@type":"Product","name":p.nombre,
     ...(p.desc?{"description":p.desc}:{}),
     ...(img?{"image":[img]}:{}),
     ...(p.marca?{"brand":{"@type":"Brand","name":p.marca}}:{}),
     "sku":p.id,"category":p.rubro,"offers":offers,
     "seller":{"@type":"Organization","name":TIENDA}},
    {"@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"Inicio","item":BASE},
      {"@type":"ListItem","position":2,"name":p.rubro,"item":BASE+'c/'+p.rubroSlug+'/'},
      {"@type":"ListItem","position":3,"name":p.nombre,"item":p.url}]}]};

  const body = `<section class="product-detail">
${barra(BASE+'c/'+p.rubroSlug+'/')}
<div class="product-detail-shell"><div class="product-detail-main">
  <div class="product-detail-image">${img?`<img src="${esc(img)}" alt="${esc(p.nombre)}${p.marca?' '+esc(p.marca):''}" width="900" height="900" decoding="async">`:'<span class="product-image-placeholder" aria-hidden="true"></span>'}</div>
  <div class="product-detail-copy">
    <div class="product-detail-category">${esc(p.rubro)}</div>
    <h1 class="product-detail-title">${esc(p.nombre)}</h1>
    ${metaFila}
    ${p.desc?`<div class="product-detail-info">${esc(p.desc)}</div>`:''}
    <div class="product-detail-buy">
      ${opciones}
      <div class="prices">
        <div><span class="price-label">Precio${p.ofertaPct>0?' (Oferta)':''}</span><div class="price-min" id="pMin">${precioMinHTML}</div></div>
        <div><span class="price-label">+$80.000</span><div class="price-may" id="pMay">$${fmt(pr.may)}</div></div>
      </div>
      <a class="add-btn" id="btnAgregar" href="${BASE}?producto=${esc(p.slug)}&amp;agregar=${esc(vis[act]||'')}">${ICONO_CARRITO} Agregar al carrito</a>
    </div>
  </div>
  ${hermanos.length?`<div class="product-detail-rel"><h3 class="pdrel-tit">Relacionados</h3><div class="pdrel-fila">${hermanos.map(miniCard).join('')}</div></div>`:''}
</div></div>
<p class="pd-pie">Paladear Mercado de Sabores · Pueyrredón 588, Mendoza · <a href="${BASE}">Ver toda la tienda</a></p>
</section>
<script>
/* Las medidas cambian el precio en pantalla, igual que en la tienda. */
(function(){
  var fmt=function(n){return new Intl.NumberFormat('es-AR').format(n);};
  var btns=document.querySelectorAll('.product-detail-options .opt-btn');
  var mn=document.getElementById('pMin'), my=document.getElementById('pMay');
  for(var i=0;i<btns.length;i++) btns[i].addEventListener('click',function(){
    for(var j=0;j<btns.length;j++) btns[j].classList.remove('active');
    this.classList.add('active');
    if(mn) mn.textContent='$'+fmt(Number(this.dataset.min||0));
    if(my) my.textContent='$'+fmt(Number(this.dataset.may||0));
    /* El botón se lleva la medida elegida, para que la tienda agregue esa. */
    var b=document.getElementById('btnAgregar');
    if(b) b.href=b.href.replace(/([?&]agregar=)[^&]*/, '$1'+encodeURIComponent(this.dataset.medida||''));
  });
})();
</script>`;
  return pagina({title:titulo, desc:descMeta, canonical:p.url, image:img, body, schema});
}

function paginaRubro(rubro, rubroSlug, prods){
  const url = BASE+'c/'+rubroSlug+'/';
  const titulo = rubro + ' en Mendoza | Paladear';
  const descMeta = recorte(`${rubro}: ${prods.slice(0,6).map(p=>p.nombre).join(', ')} y más. Comprá online en Paladear, dietética en Mendoza con envíos a todo el país.`, 158);
  const schema = {"@context":"https://schema.org","@graph":[
    {"@type":"CollectionPage","name":rubro,"url":url,
     "mainEntity":{"@type":"ItemList","numberOfItems":prods.length,
       "itemListElement":prods.slice(0,60).map((p,i)=>({"@type":"ListItem","position":i+1,"name":p.nombre,"url":p.url}))}},
    {"@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"Inicio","item":BASE},
      {"@type":"ListItem","position":2,"name":rubro,"item":url}]}]};
  const body = `<section class="product-detail">
${barra(BASE)}
<div class="product-detail-shell">
  <div class="product-detail-category">Categoría</div>
  <h1 class="product-detail-title">${esc(rubro)}</h1>
  <p class="pd-rubro-intro">${prods.length} productos de ${esc(rubro.toLowerCase())} en Paladear, dietética en Mendoza. Entrá a cada uno para ver medidas y precios.</p>
  <div class="product-detail-rel"><h3 class="pdrel-tit">Todos los productos</h3><div class="pdrel-fila">${prods.map(miniCard).join('')}</div></div>
</div>
<p class="pd-pie">Paladear Mercado de Sabores · Pueyrredón 588, Mendoza · <a href="${BASE}">Ver toda la tienda</a></p>
</section>`;
  return pagina({title:titulo, desc:descMeta, canonical:url, image:BASE+'og-image.jpg', body, schema});
}

// ───────────────────────────────────────────────────────────────
const [pricesRaw, panelRaw, indexRaw] = await Promise.all([
  readFile('precios-min.csv','utf8'), readFile('catalogo-panel.json','utf8'), readFile('index.html','utf8')
]);
const CSS = cssDeLaTienda(indexRaw);
const fichas=(JSON.parse(panelRaw)||{}).fichas||{};
if(!Object.keys(fichas).length) throw new Error('catalogo-panel.json no trae fichas');
const productos=buildProducts(pricesRaw.replace(/\r\n?/g,'\n'), fichas);
if(productos.length<50) throw new Error('Solo '+productos.length+' productos; se cancela para no romper lo publicado');

// Se marca una sola vez quien tiene foto, para poder armar las minicards.
for(const p of productos) p.tieneFoto = existsSync(path.join(SALIDA,'fotos',p.id+'.webp'));

const porRubro=new Map();
for(const p of productos){ if(!porRubro.has(p.rubro)) porRubro.set(p.rubro,[]); porRubro.get(p.rubro).push(p); }

await rm(path.join(SALIDA,'p'),{recursive:true,force:true});
await rm(path.join(SALIDA,'c'),{recursive:true,force:true});

let nFotos=0;
for(const p of productos){
  const hayFoto=p.tieneFoto;
  if(hayFoto) nFotos++;
  const hermanos=(porRubro.get(p.rubro)||[]).filter(h=>h.id!==p.id).slice(0,8);
  const dir=path.join(SALIDA,'p',p.slug);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'), paginaProducto(p,hermanos,hayFoto));
}
for(const [rubro,prods] of porRubro){
  const dir=path.join(SALIDA,'c',prods[0].rubroSlug);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'), paginaRubro(rubro,prods[0].rubroSlug,prods));
}
// ── Sitemaps ───────────────────────────────────────────────────────────────
// Ahora apuntan a las páginas reales (/p/ y /c/), no a los parámetros. Las
// direcciones ?producto= siguen funcionando para los links ya compartidos,
// pero no se declaran: index.html dice que su canónica es la portada, así que
// Google las consolida ahí en vez de tomarlas como duplicados.
const urls = [
  BASE,
  BASE + 'catalogo.html',
  ...[...porRubro.values()].map(ps => BASE + 'c/' + ps[0].rubroSlug + '/'),
  ...productos.map(p => p.url)
];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(u => '  <url><loc>' + esc(u) + '</loc></url>'),
  '</urlset>',
  ''
].join('\n');
await writeFile(path.join(SALIDA,'ficha-producto.css'), CSS);
await writeFile(path.join(SALIDA,'sitemap.xml'), sitemap);
await writeFile(path.join(SALIDA,'sitemap.txt'), urls.join('\n') + '\n');

console.log('Páginas generadas: '+productos.length+' productos ('+nFotos+' con foto) y '+porRubro.size+' rubros.');
console.log('Sitemap: '+urls.length+' direcciones.');
