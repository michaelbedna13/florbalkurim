/* Přihláška na kemp.
   Odesílá se do Google Apps Scriptu klubového účtu, který ji zapíše do Google
   tabulky, kartičku uloží na Disk a pošle e-maily vedoucímu kempu a rodiči. */
(function(){
  // Adresa nasazeného skriptu (končí na /exec). Jiná se nikde nenastavuje.
  var SKRIPT = 'https://script.google.com/macros/s/AKfycbyiNv2QSK1_SgR4qm2qsyObMeKH29Cp6s7z1urrrabJ2aKvMgmG0ekvg_9KDNHN1hI6/exec';

  var formular = document.getElementById('prihlaska');
  if(!formular) return;

  var UZAVERKA = new Date('2027-02-28T23:59:59+01:00');
  var MAX_SOUBOR = 5 * 1024 * 1024;
  var chyba = document.getElementById('chyba-odeslani');
  var tlacitko = formular.querySelector('button[type="submit"]');

  function ukaz(id){
    formular.style.display = 'none';
    document.getElementById(id).classList.add('ukazat');
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  if(new Date() > UZAVERKA){ ukaz('uzavreno'); return; }

  // Souhlas se zdravotními údaji je povinný, jen když rodič nějaké vyplní.
  // Souhlas s pojišťovnou, jen když přiloží kartičku.
  var alergie = document.getElementById('f-alergie');
  var leky = document.getElementById('f-leky');
  var karticka = document.getElementById('f-karticka');
  var sZdravi = document.getElementById('s-zdravi');
  var sPojistovna = document.getElementById('s-pojistovna');
  var NIC = /^\s*(žádn|zadn|nemá|nema|ne\b|nic|-|–|x\s*$)/i;
  function vyplneno(pole){ var v = pole.value.trim(); return v !== '' && !NIC.test(v); }
  function prizpusob(){
    sZdravi.required = vyplneno(alergie) || vyplneno(leky);
    sPojistovna.required = karticka.files.length > 0;
  }
  [alergie, leky].forEach(function(p){ p.addEventListener('input', prizpusob); });
  karticka.addEventListener('change', prizpusob);
  prizpusob();

  // Fotku kartičky z mobilu zmenším, aby se neposílalo zbytečně 5 MB.
  function nactiKarticku(){
    var f = karticka.files[0];
    if(!f) return Promise.resolve(null);
    if(f.size > MAX_SOUBOR && !/^image\//.test(f.type)){
      return Promise.reject('Kartička je moc velká, nejvýš 5 MB.');
    }
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
      var r = new FileReader();
      r.onload = function(){ hotovo({typ: f.type || 'application/pdf', data: String(r.result).split(',')[1]}); };
      r.readAsDataURL(f);
    });
  }

  formular.addEventListener('submit', function(e){
    e.preventDefault();
    chyba.textContent = '';

    var data = {};
    new FormData(formular).forEach(function(v, k){ if(typeof v === 'string') data[k] = v; });
    delete data['Kartička pojišťovny'];

    formular.querySelectorAll('[data-souhlas]').forEach(function(z){
      data[z.dataset.souhlas] = z.checked ? 'ANO' : 'NE';
    });
    var n = document.getElementById('f-narozeni').value.split('-');
    if(n.length === 3) data['Datum narození'] = Number(n[2]) + '. ' + Number(n[1]) + '. ' + n[0];
    var d = new Date();
    data['Odesláno'] = d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + ' ' +
                       d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');

    tlacitko.disabled = true;
    tlacitko.textContent = 'Odesílám…';

    nactiKarticku()
      .then(function(k){
        if(k) data.karticka = k;
        if(SKRIPT.indexOf('/exec') === -1) throw 'Přihláška ještě není napojená, zkuste to prosím později.';
        // obyčejný text jako typ obsahu, jinak by prohlížeč před odesláním posílal zbytečný dotaz navíc
        return fetch(SKRIPT, {method: 'POST', body: JSON.stringify(data)});
      })
      .then(function(o){ return o.json(); })
      .then(function(v){
        if(!v.ok) throw v.chyba || 'Přihlášku se nepodařilo uložit.';
        ukaz('odeslano');
      })
      .catch(function(err){
        chyba.textContent = (typeof err === 'string' ? err : 'Přihlášku se nepodařilo odeslat.') +
          ' Když to nepůjde ani napodruhé, napište nám na florbalkurim@gmail.com.';
        tlacitko.disabled = false;
        tlacitko.textContent = 'Odeslat přihlášku';
      });
  });
})();
