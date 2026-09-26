/* Formulář Napište nám na stránce Kontakty.
   Posílá se do stejného Google Apps Scriptu jako přihláška na kemp,
   ten zprávu přepošle předsedovi klubu a odesílateli pošle kopii. */
(function(){
  // Stejná adresa skriptu jako v prihlaska.js
  var SKRIPT = 'https://script.google.com/macros/s/AKfycbyiNv2QSK1_SgR4qm2qsyObMeKH29Cp6s7z1urrrabJ2aKvMgmG0ekvg_9KDNHN1hI6/exec';

  var f = document.getElementById('dotaz');
  if(!f) return;
  var $ = function(id){ return document.getElementById(id); };
  var chyba = $('dotaz-chyba'), tl = f.querySelector('button[type="submit"]');

  function obal(el){ return el.closest('.pole') || el.parentNode; }
  function oznac(el, text){
    var o = obal(el); o.classList.add('chybne');
    var z = o.querySelector(':scope > .zprava');
    if(!z){ z = document.createElement('p'); z.className = 'zprava'; o.appendChild(z); }
    z.textContent = text;
  }
  function vycisti(el){
    var o = obal(el); o.classList.remove('chybne');
    var z = o.querySelector(':scope > .zprava'); if(z) z.remove();
  }
  f.addEventListener('input', function(e){ if(e.target.checkValidity && e.target.checkValidity()) vycisti(e.target); });
  f.addEventListener('change', function(e){ if(e.target.checkValidity && e.target.checkValidity()) vycisti(e.target); });

  f.addEventListener('submit', function(e){
    e.preventDefault();
    chyba.textContent = '';
    var chyby = [];
    f.querySelectorAll('[required]').forEach(function(el){
      vycisti(el);
      if(!el.checkValidity()){ oznac(el, el.dataset.chyba || 'Tohle pole je potřeba vyplnit.'); chyby.push(el); }
    });
    if(chyby.length){
      obal(chyby[0]).scrollIntoView({behavior: 'smooth', block: 'center'});
      setTimeout(function(){ chyby[0].focus({preventScroll: true}); }, 350);
      return;
    }
    var data = {
      typ: 'dotaz',
      _honey: f.querySelector('[name="web_firmy"]').value,
      jmeno: $('d-jmeno').value.trim(), email: $('d-email').value.trim(),
      telefon: $('d-telefon').value.trim(), zprava: $('d-zprava').value.trim()
    };
    tl.disabled = true; tl.textContent = 'Odesílám…';
    $('dotaz-odesilam').classList.add('ukazat');
    fetch(SKRIPT, {method: 'POST', body: JSON.stringify(data)})
      .then(function(o){ return o.json(); })
      .then(function(v){
        if(!v.ok) throw v.chyba || 'Zprávu se nepodařilo odeslat';
        var p = $('dotaz-odeslan-text');
        p.textContent = 'Děkujeme, odpovíme vám co nejdřív na ';
        var b = document.createElement('b'); b.textContent = data.email; p.append(b); p.append('.');
        f.style.display = 'none';
        $('dotaz-odeslan').classList.add('ukazat');
        $('napiste-nam').scrollIntoView({behavior: 'smooth', block: 'start'});
      })
      .catch(function(err){
        var z = typeof err === 'string' ? err : 'Zprávu se nepodařilo odeslat';
        chyba.textContent = z.replace(/[.\s]*$/, '.') + ' Zkuste to prosím znovu, nebo zavolejte na 737 838 002.';
        tl.disabled = false; tl.textContent = 'Odeslat zprávu';
        $('dotaz-odesilam').classList.remove('ukazat');
      });
  });
})();
