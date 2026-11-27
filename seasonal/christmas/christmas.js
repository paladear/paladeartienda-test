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
    lights.innerHTML='<svg class="pal-xmas-wire" viewBox="0 0 100 44" preserveAspectRatio="none"><path d="M-3 5 C5 38 18 38 27 5 C35 38 50 38 58 5 C67 38 83 38 91 5 C96 25 101 25 103 5"/></svg>';
    var alturas=[8,20,31,37,31,19,8,18,31,37,33,21,8,16,29,36,32,20];
    for(var i=0;i<18;i++){var bulb=document.createElement('i');bulb.className='pal-xmas-bulb';bulb.style.left=(2.5+i*5.65)+'%';bulb.style.setProperty('--y',alturas[i]+'px');bulb.style.setProperty('--i',i);lights.appendChild(bulb);}
    header.appendChild(lights);

    var decor=document.createElement('div');decor.className='pal-xmas-hero-decor';decor.setAttribute('aria-hidden','true');
    decor.appendChild(img('ornaments.webp','pal-xmas-ornaments'));
    decor.appendChild(img('gold-bow.webp','pal-xmas-bow'));
    var stars=document.createElement('div');stars.className='pal-xmas-stars';
    [[63,25,12,'#fffdf7','-.4s'],[78,43,9,'#e9bd67','-1.7s'],[92,25,7,'#fffdf7','-2.8s'],[56,57,7,'#e9bd67','-.9s'],[87,61,11,'#fffdf7','-2.1s'],[69,72,6,'#e9bd67','-3.1s']].forEach(function(v){var s=document.createElement('i');s.className='pal-xmas-star';s.style.left=v[0]+'%';s.style.top=v[1]+'%';s.style.setProperty('--s',v[2]+'px');s.style.setProperty('--c',v[3]);s.style.setProperty('--d',v[4]);stars.appendChild(s);});
    decor.appendChild(stars);hero.appendChild(decor);

    var offer=document.querySelector('.bnav button[data-b="ofertas"]');
    if(offer){var gift=img('gift-filled.svg','pal-xmas-gift');offer.appendChild(gift);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
