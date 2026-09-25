/* Přihláška na kemp, jedna přihláška může obsahovat víc dětí.
   Odesílá se do Google Apps Scriptu klubového účtu, který každé dítě zapíše
   do Google tabulky na vlastní řádek, kartičky uloží na Disk a pošle jeden
   e-mail vedoucímu kempu a jedno potvrzení rodiči. */
(function(){
  // Adresa nasazeného skriptu (končí na /exec). Jiná se nikde nenastavuje.
  var SKRIPT = 'https://script.google.com/macros/s/AKfycbyiNv2QSK1_SgR4qm2qsyObMeKH29Cp6s7z1urrrabJ2aKvMgmG0ekvg_9KDNHN1hI6/exec';

  var formular = document.getElementById('prihlaska');
  if(!formular) return;

  var UZAVERKA = new Date('2027-02-28T23:59:59+01:00');
  var ZACATEK_KEMPU = new Date('2027-07-26T08:00:00+02:00');
  var VEK = [6, 13];
  var MAX_DETI = 5;
  var MAX_SOUBOR = 5 * 1024 * 1024;
  var MESICE = ['leden','únor','březen','duben','květen','červen','červenec',
                'srpen','září','říjen','listopad','prosinec'];
  var $ = function(id){ return document.getElementById(id); };
  var chybaOdeslani = $('chyba-odeslani');
  var tlacitko = formular.querySelector('button[type="submit"]');
  var deti = $('deti');
  var sablona = $('sablona-dite').innerHTML;
  var pocitadlo = 0;

  function ukaz(id){
    formular.style.display = 'none';
    $(id).classList.add('ukazat');
    $(id).closest('section').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  if(new Date() > UZAVERKA){ ukaz('uzavreno'); return; }

  /* ---------- chyby přímo u polí ---------- */
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

  /* ---------- jedno dítě ---------- */
  function datumNarozeni(blok){
    var d = blok.querySelector('[data-k="den"]').value,
        m = blok.querySelector('[data-k="mesic"]').value,
        r = blok.querySelector('[data-k="rok"]').value;
    if(!d || !m || !r) return null;
    var x = new Date(Number(r), Number(m) - 1, Number(d));
    return x.getMonth() === Number(m) - 1 ? x : false;   // 31. února a podobně
  }
  function vekNaKempu(d){
    var v = ZACATEK_KEMPU.getFullYear() - d.getFullYear();
    var m = ZACATEK_KEMPU.getMonth() - d.getMonth();
    if(m < 0 || (m === 0 && ZACATEK_KEMPU.getDate() < d.getDate())) v--;
    return v;
  }
  // „Nemá žádné“ se zapíše výslovně, jinak text, který rodič napsal
  function hodnotaVolby(blok, pole){
    var v = blok.querySelector('.volby[data-volba="' + pole + '"] input:checked');
    var t = blok.querySelector('textarea[data-k="' + pole + '"]');
    return v && v.value === 'ano' ? t.value.trim() : t.dataset.ne;
  }
  function vybraneTreninky(blok){
    return Array.prototype.map.call(blok.querySelectorAll('.treninky-volby input:checked'),
      function(i){ return i.value; });
  }

  function pridejDite(){
    if(deti.children.length >= MAX_DETI) return;
    pocitadlo++;
    var obalDite = document.createElement('div');
    obalDite.innerHTML = sablona.replace(/__N__/g, pocitadlo);
    var blok = obalDite.firstElementChild;

    // datum narození
    var den = blok.querySelector('[data-k="den"]'), mesic = blok.querySelector('[data-k="mesic"]'),
        rok = blok.querySelector('[data-k="rok"]');
    for(var i = 1; i <= 31; i++) den.add(new Option(i + '.', i));
    MESICE.forEach(function(m, i){ mesic.add(new Option(m, i + 1)); });
    var rk = ZACATEK_KEMPU.getFullYear();
    for(var r = rk; r >= rk - 25; r--) rok.add(new Option(r, r));
    [den, mesic, rok].forEach(function(s){
      s.addEventListener('change', function(){
        var d = datumNarozeni(blok), u = blok.querySelector('[data-vek]');
        u.textContent = '';
        if(d) vycisti(den);
        if(!d) return;
        var v = vekNaKempu(d);
        if(v < VEK[0] || v > VEK[1]){
          var slovo = v === 1 ? 'rok' : (v >= 2 && v <= 4) ? 'roky' : 'let';
          u.textContent = 'Na začátku kempu mu bude ' + v + ' ' + slovo +
            '. Kemp je pro děti od 6 do 13 let, přihlášku ale klidně pošlete a domluvíme se.';
        }
      });
    });

    // tréninky: „nechodí“ a konkrétní tréninky se vylučují
    var treninky = blok.querySelector('.treninky-volby');
    treninky.addEventListener('change', function(e){
      var t = e.target;
      if(t.checked){
        treninky.querySelectorAll('input').forEach(function(i){
          if(i !== t && (t.hasAttribute('data-vylucny') || i.hasAttribute('data-vylucny'))) i.checked = false;
        });
      }
      if(vybraneTreninky(blok).length) vycisti(t);
    });

    // alergie a léky: povinná volba, popis jen když „má“
    blok.querySelectorAll('.volby[data-volba]').forEach(function(v){
      var text = v.parentNode.querySelector('textarea.doplneni');
      v.addEventListener('change', function(){
        var ma = v.querySelector('input:checked').value === 'ano';
        text.classList.toggle('ukazat', ma);
        text.required = ma;
        if(ma) setTimeout(function(){ text.focus(); }, 50);
        else { text.value = ''; }
      });
    });

    // kartička: náhled a odebrání
    var karticka = blok.querySelector('[data-k="karticka"]'), nahrano = blok.querySelector('[data-nahrano]'),
        nahled = blok.querySelector('[data-nahled]');
    function ukazKarticku(){
      var f = karticka.files[0];
      if(nahled.getAttribute('src')) URL.revokeObjectURL(nahled.src);
      if(!f){ nahrano.classList.remove('ukazat'); nahled.removeAttribute('src'); return; }
      blok.querySelector('[data-nazev]').textContent = f.name;
      if(/^image\//.test(f.type)){ nahled.src = URL.createObjectURL(f); nahled.style.display = ''; }
      else { nahled.removeAttribute('src'); nahled.style.display = 'none'; }
      nahrano.classList.add('ukazat');
      vycisti(karticka);
    }
    karticka.addEventListener('change', ukazKarticku);
    blok.querySelector('[data-odebrat-karticku]').addEventListener('click', function(){
      karticka.value = ''; ukazKarticku();
    });

    blok.querySelector('[data-odebrat]').addEventListener('click', function(){
      blok.remove(); precisluj();
    });

    deti.appendChild(blok);
    precisluj();
    return blok;
  }

  function precisluj(){
    var bloky = deti.querySelectorAll('[data-dite]');
    bloky.forEach(function(b, i){
      b.querySelector('[data-poradi]').textContent = i + 1;
      b.querySelector('[data-odebrat]').style.display = bloky.length > 1 ? '' : 'none';
    });
    $('pridat-dite').style.display = bloky.length >= MAX_DETI ? 'none' : '';
  }

  $('pridat-dite').addEventListener('click', function(){
    var blok = pridejDite();
    if(!blok) return;
    blok.scrollIntoView({behavior: 'smooth', block: 'start'});
    setTimeout(function(){ blok.querySelector('[data-k="Jméno dítěte"]').focus({preventScroll: true}); }, 400);
  });
  pridejDite();

  /* ---------- kontrola celé přihlášky ---------- */
  function zkontroluj(){
    var chyby = [];
    function over(el, podminka, text){
      vycisti(el);
      if(!podminka){ oznac(el, text); chyby.push(el); }
    }
    // rodič a souhlasy
    formular.querySelectorAll('fieldset:not(:nth-of-type(2)) input, fieldset:not(:nth-of-type(2)) textarea').forEach(function(el){
      if(el.type === 'hidden' || el.classList.contains('past') || !el.hasAttribute('required')) return;
      over(el, el.checkValidity(), el.dataset.chyba || 'Tohle pole je potřeba vyplnit.');
    });
    formular.querySelectorAll('[data-souhlas-volba]').forEach(function(v){
      over(v.querySelector('input'), v.querySelector('input:checked'), v.dataset.chyba);
    });
    // každé dítě
    deti.querySelectorAll('[data-dite]').forEach(function(blok){
      // volby nejdřív: u alergií a léků sdílí místo na hlášku s popisem,
      // a chybějící popis po zvolení „má“ musí mít poslední slovo
      blok.querySelectorAll('.volby').forEach(function(v){
        over(v.querySelector('input'), v.querySelector('input:checked'), v.dataset.chyba);
      });
      blok.querySelectorAll('input[required], textarea[required]').forEach(function(el){
        over(el, el.checkValidity(), el.dataset.chyba || 'Tohle pole je potřeba vyplnit.');
      });
      var den = blok.querySelector('[data-k="den"]'), d = datumNarozeni(blok);
      over(den, d, d === false ? 'Takové datum neexistuje, zkontrolujte den a měsíc.' : 'Vyberte den, měsíc i rok narození.');
      var prvni = blok.querySelector('.treninky-volby input');
      over(prvni, vybraneTreninky(blok).length, blok.querySelector('.treninky-volby').dataset.chyba);
      var k = blok.querySelector('[data-k="karticka"]'), f = k.files[0];
      over(k, f && (/^image\//.test(f.type) || f.size <= MAX_SOUBOR),
           f ? 'Soubor je moc velký, nejvýš 5 MB.' : 'Přiložte fotku nebo sken kartičky pojišťovny.');
    });
    return chyby;
  }
  formular.addEventListener('input', function(e){
    var t = e.target;
    if(obal(t).classList.contains('chybne') && t.checkValidity && t.checkValidity()) vycisti(t);
  });
  formular.addEventListener('change', function(e){
    var t = e.target;
    if(t.type === 'radio' || (t.type === 'checkbox' && !t.closest('.treninky-volby'))) vycisti(t);
  });

  /* ---------- fotka kartičky se před odesláním zmenší ---------- */
  function nactiSoubor(f){
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

  /* ---------- potvrzení po odeslání ---------- */
  function potvrzeni(jmena, email){
    var p = $('odeslano-text');
    p.textContent = '';
    // jména v prvním pádě, automaticky se skloňovat nedají
    p.append(jmena.length > 1 ? 'Přihláška na jména ' : 'Přihláška na jméno ');
    jmena.forEach(function(j, i){
      if(i) p.append(i === jmena.length - 1 ? ' a ' : ', ');
      var b = document.createElement('b'); b.textContent = j; p.append(b);
    });
    p.append(' k nám dorazila. Potvrzení odešlo na ');
    var e = document.createElement('b'); e.textContent = email; p.append(e);
    p.append('.');
  }

  /* ---------- odeslání ---------- */
  formular.addEventListener('submit', function(e){
    e.preventDefault();
    chybaOdeslani.textContent = '';

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
    ['_honey','Jméno rodiče','email','Telefon','Bydliště'].forEach(function(k){
      var el = formular.querySelector('[name="' + k + '"]');
      data[k] = el ? el.value : '';
    });
    formular.querySelectorAll('[data-souhlas]').forEach(function(z){
      data[z.dataset.souhlas] = z.checked ? 'ANO' : 'NE';
    });
    formular.querySelectorAll('[data-souhlas-volba]').forEach(function(v){
      data[v.dataset.souhlasVolba] = v.querySelector('input:checked').value;
    });
    var nyni = new Date();
    data['Odesláno'] = nyni.getDate() + '. ' + (nyni.getMonth() + 1) + '. ' + nyni.getFullYear() + ' ' +
                       nyni.getHours() + ':' + String(nyni.getMinutes()).padStart(2, '0');

    var bloky = Array.prototype.slice.call(deti.querySelectorAll('[data-dite]'));
    var seznam = bloky.map(function(blok){
      var d = datumNarozeni(blok);
      return {
        'Jméno dítěte': blok.querySelector('[data-k="Jméno dítěte"]').value.trim(),
        'Datum narození': d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(),
        'Trénink': vybraneTreninky(blok).join('; '),
        'Alergie a zdravotní omezení': hodnotaVolby(blok, 'Alergie a zdravotní omezení'),
        'Léky během kempu': hodnotaVolby(blok, 'Léky během kempu'),
        'Plavec': blok.querySelector('[data-k="Plavec"] input:checked').value,
        'Odchází samo': blok.querySelector('[data-k="Odchází samo"] input:checked').value
      };
    });

    tlacitko.disabled = true;
    tlacitko.textContent = 'Odesílám…';

    Promise.all(bloky.map(function(blok){ return nactiSoubor(blok.querySelector('[data-k="karticka"]').files[0]); }))
      .then(function(soubory){
        soubory.forEach(function(s, i){ seznam[i].karticka = s; });
        data.deti = seznam;
        // obyčejný text jako typ obsahu, jinak by prohlížeč před odesláním posílal zbytečný dotaz navíc
        return fetch(SKRIPT, {method: 'POST', body: JSON.stringify(data)});
      })
      .then(function(o){ return o.json(); })
      .then(function(v){
        if(!v.ok) throw v.chyba || 'Přihlášku se nepodařilo uložit.';
        potvrzeni(seznam.map(function(d){ return d['Jméno dítěte']; }), data.email);
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
