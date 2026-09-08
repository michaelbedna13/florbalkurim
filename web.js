/* Mobilní menu + zástupná místa za chybějící fotky.
   Víc na tomhle webu nic neběží — všechno ostatní je čisté HTML. */

document.addEventListener('click', function(e){
  var tl = e.target.closest('.prepinac');
  if(tl){
    var menu = document.getElementById('menu');
    var otevreno = menu.classList.toggle('otevreno');
    tl.setAttribute('aria-expanded', otevreno ? 'true' : 'false');
    return;
  }
  if(!e.target.closest('.hlavicka')){
    var m = document.getElementById('menu');
    if(m) m.classList.remove('otevreno');
  }
});

/* Když fotka ještě není nahraná, ukáž pruhované místo s popisem,
   ať je na první pohled vidět, co kam patří. */
function zastup(o){
  var n = document.createElement('div');
  n.className = 'mistofoto';
  n.textContent = o.dataset.misto;
  o.replaceWith(n);
}
document.querySelectorAll('img[data-misto]').forEach(function(o){
  /* obrázek se mohl načíst dřív, než doběhl tenhle skript */
  if(o.complete && o.naturalWidth === 0){ zastup(o); return; }
  o.addEventListener('error', function(){ zastup(o); });
});
