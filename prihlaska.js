/* Přihláška na kemp.
   Odesílá se do Google Apps Scriptu klubového účtu, který ji zapíše do Google
   tabulky, kartičku uloží na Disk a pošle e-maily vedoucímu kempu a rodiči. */
(function(){
  // Adresa nasazeného skriptu (končí na /exec). Jiná se nikde nenastavuje.
  var SKRIPT = 'https://script.google.com/macros/s/AKfycbyiNv2QSK1_SgR4qm2qsyObMeKH29Cp6s7z1urrrabJ2aKvMgmG0ekvg_9KDNHN1hI6/exec';

  var formular = document.getElementById('prihlaska');
  if(!formular) return;

  var UZAVERKA = new Date('2027-02-28T23:59:59+01:00');
  var ZACATEK_KEMPU = new Date('2027-07-26T08:00:00+02:00');
  var VEK = [6, 13];
  var MAX_SOUBOR = 5 * 1024 * 1024;
  var chybaOdeslani = document.getElementById('chyba-odeslani');
  var tlacitko = formular.querySelector('button[type="submit"]');
  var $ = function(id){ return document.getElementById(id); };

  function ukaz(id){
    formular.style.display = 'none';
    $(id).classList.add('ukazat');
    $(id).scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  if(new Date() > UZAVERKA){ ukaz('uzavreno'); return; }

  /* ---------- datum narození ze tří výběrů ---------- */
  var MESICE = ['leden','únor','březen','duben','květen','červen','červenec',
                'srpen','září','říjen','listopad','prosinec'];
  var den = $('f-den'), mesic = $('f-mesic'), rok = $('f-rok');
  for(var i = 1; i <= 31; i++) den.add(new Option(i + '.', i));
  MESICE.forEach(function(m, i){ mesic.add(new Option(m, i + 1)); });
  var rokKempu = ZACATEK_KEMPU.getFullYear();
  for(var r = rokKempu; r >= rokKempu - 25; r--) rok.add(new Option(r, r));

  function datumNarozeni(){
    if(!den.value || !mesic.value || !rok.value) return null;
    var d = new Date(Number(rok.value), Number(mesic.value) - 1, Number(den.value));
    // 31. února a podobně: Date by to přehodil do dalšího měsíce
    return d.getMonth() === Number(mesic.value) - 1 ? d : false;
  }
  function vekNaKempu(d){
    var v = ZACATEK_KEMPU.getFullYear() - d.getFullYear();
    var m = ZACATEK_KEMPU.getMonth() - d.getMonth();
    if(m < 0 || (m === 0 && ZACATEK_KEMPU.getDate() < d.getDate())) v--;
    return v;
  }
  function kontrolaVeku(){
    var d = datumNarozeni(), u = $('vek-upozorneni');
    u.textContent = '';
    if(!d) return;
    var v = vekNaKempu(d);
    if(v < VEK[0] || v > VEK[1]){
      var let_ = v === 1 ? 'rok' : (v >= 2 && v <= 4) ? 'roky' : 'let';
      u.textContent = 'Na začátku kempu mu bude ' + v + ' ' + let_ + '. Kemp je pro děti od 6 do 13 let, ' +
                      'přihlášku ale klidně pošlete a domluvíme se.';
    }
  }
  [den, mesic, rok].forEach(function(s){ s.addEventListener('change', kontrolaVeku); });

  /* ---------- tréninky: jde jich vybrat víc ---------- */
  var treninky = formular.querySelector('.treninky-volby');
  treninky.addEventListener('change', function(e){
    var t = e.target;
    if(!t.checked) return;
    treninky.querySelectorAll('input').forEach(function(i){
      if(i === t) return;
      // „nechodí“ a konkrétní tréninky se vylučují
      if(t.hasAttribute('data-vylucny') || i.hasAttribute('data-vylucny')) i.checked = false;
    });
  });
  function vybraneTreninky(){
    return Array.prototype.map.call(treninky.querySelectorAll('input:checked'), function(i){ return i.value; });
  }

  /* ---------- podmíněné souhlasy ---------- */
  var alergie = $('f-alergie'), leky = $('f-leky'), karticka = $('f-karticka');
  var sZdravi = $('s-zdravi'), sPojistovna = $('s-pojistovna');
  var NIC = /^\s*(žádn|zadn|nemá|nema|ne\b|nic|-|–|x\s*$)/i;
  function vyplneno(p){ var v = p.value.trim(); return v !== '' && !NIC.test(v); }
  function prizpusob(){
    sZdravi.required = vyplneno(alergie) || vyplneno(leky);
    sPojistovna.required = karticka.files.length > 0;
  }
  [alergie, leky].forEach(function(p){ p.addEventListener('input', prizpusob); });

  /* ---------- kartička: náhled a odebrání ---------- */
  var nahrano = $('nahrano'), nahled = $('nahrano-nahled');
  function ukazKarticku(){
    var f = karticka.files[0];
    if(nahled.src) URL.revokeObjectURL(nahled.src);
    if(!f){ nahrano.classList.remove('ukazat'); nahled.removeAttribute('src'); return; }
    $('nahrano-nazev').textContent = f.name;
    if(/^image\//.test(f.type)){ nahled.src = URL.createObjectURL(f); nahled.style.display = ''; }
    else { nahled.removeAttribute('src'); nahled.style.display = 'none'; }
    nahrano.classList.add('ukazat');
  }
  karticka.addEventListener('change', function(){ ukazKarticku(); prizpusob(); });
  $('nahrano-odebrat').addEventListener('click', function(){
    karticka.value = ''; ukazKarticku(); prizpusob(); vycisti(sPojistovna);
  });
  prizpusob();

  /* ---------- kontrola polí s hláškou přímo u pole ---------- */
  function obal(el){ return el.closest('.pole, .zaskrt') || el.parentNode; }
  function oznac(el, text){
    var o = obal(el);
    o.classList.add('chybne');
    var z = o.querySelector(':scope > .zprava');
    if(!z){ z = document.createElement('p'); z.className = 'zprava'; o.appendChild(z); }
    z.textContent = text;
  }
  function vycisti(el){
    var o = obal(el);
    o.classList.remove('chybne');
    var z = o.querySelector(':scope > .zprava');
    if(z) z.remove();
  }
  function zkontroluj(){
    var chyby = [];
    // jednotlivá pole
    formular.querySelectorAll('input, select, textarea').forEach(function(el){
      if(el.type === 'radio' || el.type === 'hidden' || el.type === 'file' || el.classList.contains('past')) return;
      if(el.closest('.datum') || el.closest('.treninky-volby')) return;
      vycisti(el);
      if(!el.checkValidity()){ oznac(el, el.dataset.chyba || 'Tohle pole je potřeba vyplnit.'); chyby.push(el); }
    });
    // datum narození
    var d = datumNarozeni();
    vycisti(den);
    if(d === null){ oznac(den, 'Vyberte den, měsíc i rok narození.'); chyby.push(den); }
    else if(d === false){ oznac(den, 'Takové datum neexistuje, zkontrolujte den a měsíc.'); chyby.push(den); }
    // tréninky
    var prvni = treninky.querySelector('input');
    vycisti(prvni);
    if(!vybraneTreninky().length){ oznac(prvni, treninky.dataset.chyba); chyby.push(prvni); }
    // skupiny přepínačů
    formular.querySelectorAll('.volby').forEach(function(v){
      var r = v.querySelector('input[type="radio"]');
      vycisti(r);
      if(!v.querySelector('input:checked')){ oznac(r, v.dataset.chyba); chyby.push(r); }
    });
    // velikost kartičky, kdyby to bylo PDF
    var f = karticka.files[0];
    vycisti(karticka);
    if(f && !/^image\//.test(f.type) && f.size > MAX_SOUBOR){
      oznac(karticka, 'Soubor je moc velký, nejvýš 5 MB.'); chyby.push(karticka);
    }
    return chyby;
  }
  // chyba zmizí, jakmile člověk pole opraví
  formular.addEventListener('input', function(e){ if(obal(e.target).classList.contains('chybne') && e.target.checkValidity()) vycisti(e.target); });
  formular.addEventListener('change', function(e){
    var t = e.target;
    if(t.type === 'radio') vycisti(t);
    else if(t.closest('.treninky-volby')){ if(vybraneTreninky().length) vycisti(t); }
    else if(t.closest('.datum')){ if(datumNarozeni()) vycisti(den); }
    else if(t.checkValidity()) vycisti(t);
  });

  /* ---------- fotka kartičky se před odesláním zmenší ---------- */
  function nactiKarticku(){
    var f = karticka.files[0];
    if(!f) return Promise.resolve(null);
    if(/^image\//.test(f.type)){
      return new Promise(function(hotovo, chybka){
        var img = new Image();
        img.onload = function(){
          var m = Math.min(1, 1600 / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * m); c.height = Math.round(img.height * m);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(img.src);
          hotovo({typ: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1]});
        };
        img.onerror = function(){ chybka('Fotku kartičky se nepodařilo načíst. Zkuste jiný soubor.'); };
        img.src = URL.createObjectURL(f);
      });
    }
    return new Promise(function(hotovo){
      var rd = new FileReader();
      rd.onload = function(){ hotovo({typ: f.type || 'application/pdf', data: String(rd.result).split(',')[1]}); };
      rd.readAsDataURL(f);
    });
  }

  /* ---------- odeslání ---------- */
  formular.addEventListener('submit', function(e){
    e.preventDefault();
    chybaOdeslani.textContent = '';
    prizpusob();

    var chyby = zkontroluj();
    if(chyby.length){
      chybaOdeslani.textContent = chyby.length === 1
        ? 'Jedno pole je potřeba opravit, je označené červeně.'
        : 'Pár polí je potřeba opravit, jsou označená červeně.';
      obal(chyby[0]).scrollIntoView({behavior: 'smooth', block: 'center'});
      setTimeout(function(){ chyby[0].focus({preventScroll: true}); }, 350);
      return;
    }

    var data = {};
    new FormData(formular).forEach(function(v, k){ if(typeof v === 'string') data[k] = v; });
    formular.querySelectorAll('[data-souhlas]').forEach(function(z){
      data[z.dataset.souhlas] = z.checked ? 'ANO' : 'NE';
    });
    data['Trénink'] = vybraneTreninky().join('; ');
    var d = datumNarozeni();
    data['Datum narození'] = d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
    var nyni = new Date();
    data['Odesláno'] = nyni.getDate() + '. ' + (nyni.getMonth() + 1) + '. ' + nyni.getFullYear() + ' ' +
                       nyni.getHours() + ':' + String(nyni.getMinutes()).padStart(2, '0');

    tlacitko.disabled = true;
    tlacitko.textContent = 'Odesílám…';

    nactiKarticku()
      .then(function(k){
        if(k) data.karticka = k;
        // obyčejný text jako typ obsahu, jinak by prohlížeč před odesláním posílal zbytečný dotaz navíc
        return fetch(SKRIPT, {method: 'POST', body: JSON.stringify(data)});
      })
      .then(function(o){ return o.json(); })
      .then(function(v){
        if(!v.ok) throw v.chyba || 'Přihlášku se nepodařilo uložit.';
        ukaz('odeslano');
      })
      .catch(function(err){
        chybaOdeslani.textContent = (typeof err === 'string' ? err : 'Přihlášku se nepodařilo odeslat.') +
          ' Když to nepůjde ani napodruhé, napište nám na florbalkurim@gmail.com.';
        tlacitko.disabled = false;
        tlacitko.textContent = 'Odeslat přihlášku';
      });
  });
})();
