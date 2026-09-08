/* Mobilní menu, zástupná místa za chybějící fotky a automatické ročníky.
   Víc na tomhle webu nic neběží. */

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

/* Když fotka ještě není nahraná, ukáž pruhované místo s popisem. */
function zastup(o){
  var n = document.createElement('div');
  n.className = 'mistofoto';
  n.textContent = o.dataset.misto;
  o.replaceWith(n);
}
document.querySelectorAll('img[data-misto]').forEach(function(o){
  if(o.complete && o.naturalWidth === 0){ zastup(o); return; }
  o.addEventListener('error', function(){ zastup(o); });
});

/* ---------- ročníky a sezóna se počítají samy ----------
   Sezóna se láme v červenci. Kategorie jsou dané věkem, takže ročníky
   z něj jdou dopočítat a každý rok se posunou bez zásahu.
   Věková rozpětí v data-vek jsou to jediné, co se udržuje ručně. */
(function(){
  var d = new Date();
  var rok = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;

  document.querySelectorAll('.sezona-auto').forEach(function(o){
    o.textContent = rok + '/' + String((rok + 1) % 100).padStart(2, '0');
  });

  document.querySelectorAll('[data-vek]').forEach(function(o){
    var cil = o.querySelector('.rocniky-auto');
    if(!cil) return;
    var m = o.dataset.vek.match(/^(\d+)\D+(\d+)$/);
    if(!m) return;
    var nejmladsi = rok - Number(m[2]);   // nejmladší ročník v kategorii
    var nejstarsi = rok - Number(m[1]);
    cil.textContent = nejmladsi + '–' + nejstarsi;
  });
})();
