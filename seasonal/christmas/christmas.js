(function(){
  'use strict';
  if(window.__palChristmasMounted)return;
  window.__palChristmasMounted=true;

  var ASSET='seasonal/christmas/';
  function img(src,cls,alt){var el=document.createElement('img');el.src=ASSET+src;el.className=cls;el.alt=alt||'';el.setAttribute('aria-hidden','true');el.decoding='async';return el;}
  function mount(){
    var body=document.body,logo=document.querySelector('.header .logo-wrap'),header=document.querySelector('.header'),hero=document.querySelector('.min-home-hero');
    if(!body||!logo||!header||!hero)return;
    body.classList.add('pal-christmas');

    logo.appendChild(img('blue-santa-hat.webp','pal-xmas-hat'));

    var lights=document.createElement('div');lights.className='pal-xmas-lights';lights.setAttribute('aria-hidden','true');
    lights.innerHTML='<svg class="pal-xmas-wire" viewBox="0 0 100 52" preserveAspectRatio="none"><path class="pal-xmas-wire-main" d="M-5 8 C2 8 5 39 14 39 S25 8 34 8 S45 39 54 39 S65 8 74 8 S85 39 94 39 S101 12 105 12"/><path class="pal-xmas-wire-soft" d="M-5 18 C8 39 18 8 30 21 S51 35 63 15 S83 9 105 29"/></svg>';
    var alturas=[10,23,35,42,35,21,9,20,35,42,37,24,9,18,33,41,36,22];
    for(var i=0;i<18;i++){var bulb=document.createElement('i');bulb.className='pal-xmas-bulb';bulb.style.left=(2.5+i*5.65)+'%';bulb.style.setProperty('--y',alturas[i]+'px');bulb.style.setProperty('--i',i);lights.appendChild(bulb);}
    header.appendChild(lights);

    var decor=document.createElement('div');decor.className='pal-xmas-hero-decor';decor.setAttribute('aria-hidden','true');
    decor.appendChild(img('ornaments.webp','pal-xmas-ornaments'));
    decor.appendChild(img('gold-bow.webp','pal-xmas-bow'));
    var stars=document.createElement('div');stars.className='pal-xmas-stars';
    [[60,22,15,'#fffdf7','-.4s'],[77,40,12,'#f0c56b','-1.7s'],[92,24,10,'#fffdf7','-2.8s'],[55,55,10,'#f0c56b','-.9s'],[87,59,15,'#fffdf7','-2.1s'],[68,71,9,'#f0c56b','-3.1s'],[48,36,8,'#fffdf7','-1.2s'],[94,74,8,'#f0c56b','-2.5s']].forEach(function(v){var s=document.createElement('i');s.className='pal-xmas-star';s.style.left=v[0]+'%';s.style.top=v[1]+'%';s.style.setProperty('--s',v[2]+'px');s.style.setProperty('--c',v[3]);s.style.setProperty('--d',v[4]);stars.appendChild(s);});
    decor.appendChild(stars);hero.appendChild(decor);

    var offer=document.querySelector('.bnav button[data-b="ofertas"]');
    if(offer){var gift=img('gift-reference.png','pal-xmas-gift');offer.appendChild(gift);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
