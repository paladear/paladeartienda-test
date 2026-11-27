(function(){
  'use strict';
  if(window.__palChristmasMounted)return;
  window.__palChristmasMounted=true;

  var ASSET='seasonal/christmas/';
  function img(src,cls,alt){var el=document.createElement('img');el.src=ASSET+src;el.className=cls;el.alt=alt||'';el.setAttribute('aria-hidden','true');el.decoding='async';return el;}

  function mount(){
    var body=document.body,
        logo=document.querySelector('.header .logo-wrap'),
        hero=document.querySelector('.min-home-hero');
    if(!body||!logo||!hero)return;
    body.classList.add('pal-christmas');

    /* El logo navideno viene con el gorro YA integrado (lo armo Juani). Se
       superpone al logo normal calzando circulo contra circulo, asi el aro
       blanco y la sombra que ya tiene el header siguen siendo los mismos.
       Todo lo demas (luces, bolitas, mono, estrellas) viene dentro de la foto
       del hero: dibujarlo encima lo duplicaba. */
    logo.appendChild(img('logo-navidad.webp','pal-xmas-logo'));

    /* Hero de diciembre. Se guarda el original en un data-* para que apagar el
       modo navideno lo devuelva sin tener que tocar el index. */
    var fuente=hero.querySelector('picture source[media]');
    if(fuente){
      fuente.setAttribute('data-pal-original',fuente.getAttribute('srcset')||'');
      /* ?v=2: a la foto se le corrio el crema de abajo a #f5e8d6 para que
         empalme con el banner de Descuento por cantidad. Sin el ?v= el
         navegador seguia mostrando la version vieja. */
      fuente.setAttribute('srcset',ASSET+'hero-navidad.webp?v=3');
    }
    var base=hero.querySelector('picture img');
    if(base){ base.setAttribute('data-pal-original',base.getAttribute('src')||''); }

    /* El regalo reemplaza al icono de Ofertas en la barra de abajo. */
    var offer=document.querySelector('.bnav button[data-b="ofertas"]');
    if(offer)offer.appendChild(img('regalo-navidad.webp','pal-xmas-gift'));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
