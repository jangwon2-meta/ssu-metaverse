(function(){var K='ssu_lang';
function get(){try{return localStorage.getItem(K)||'ko'}catch(e){return 'ko'}}
function apply(l){document.documentElement.lang=l;
 document.querySelectorAll('[data-ko]').forEach(function(e){var v=e.getAttribute('data-'+l);if(v==null)v=e.getAttribute('data-ko');e.innerHTML=v});
 document.querySelectorAll('[data-lang]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-lang')===l);b.setAttribute('aria-pressed',b.getAttribute('data-lang')===l)});
 document.dispatchEvent(new CustomEvent('ssu:lang',{detail:l}))}
window.ssuLang=get;
window.ssuSetLang=function(l){try{localStorage.setItem(K,l)}catch(e){}apply(l)};
window.addEventListener('storage',function(e){if(e.key===K)apply(e.newValue||'ko')});
apply(get());
var hd=document.querySelector('.hd'),bg=document.querySelector('.burger');
if(bg)bg.addEventListener('click',function(){var o=hd.classList.toggle('open');bg.setAttribute('aria-expanded',o)});
})();
