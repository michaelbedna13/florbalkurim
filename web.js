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

  document.querySelectorAll('.rok-auto').forEach(function(o){
    o.textContent = d.getFullYear();
  });

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

/* ---------- tabulky na stránce Muži ----------
   Data píše dvakrát denně robot v repozitáři appky, tenhle web si je
   jen stahuje. Jeden zdroj pravdy, žádná druhá kopie stahovačů. */
(function(){
  /* JSONy leží v kořeni tohohle webu. Předponu si vezmu ze stejného místa,
     odkud se načítá styl, aby to sedělo v kořeni i v podsložce. */
  var odkazStylu = document.querySelector('link[rel="stylesheet"][href$="styl.css"]');
  var ZDROJ = odkazStylu ? odkazStylu.getAttribute('href').replace(/styl\.css$/, '') : '';

  function bunka(text, tridy){
    var td = document.createElement('td');
    if(tridy) td.className = tridy;
    td.textContent = text;
    return td;
  }

  function hlaska(telo, text, sloupcu){
    telo.innerHTML = '';
    var tr = telo.insertRow();
    var td = tr.insertCell();
    td.colSpan = sloupcu;
    td.style.textAlign = 'center';
    td.style.padding = '26px';
    td.textContent = text;
  }

  function datumCesky(iso){
    var d = iso.split('-');
    return Number(d[2]) + '. ' + Number(d[1]) + '.';
  }

  function razitko(telo, kdy){
    var pozn = telo.closest('section').querySelector('.poznamka-dat');
    if(!pozn || !kdy) return;
    var d = new Date(kdy);
    if(isNaN(d)) return;
    pozn.textContent = 'Zdroj: Český florbal. Naposledy staženo '
      + d.getDate() + '. ' + (d.getMonth() + 1) + '. v '
      + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + '.';
  }

  function nacti(soubor, telo, sloupcu, vykresli, prazdne){
    fetch(ZDROJ + soubor)
      .then(function(o){
        /* Soubor ještě nevznikl. Návštěvníkovi stačí vlídná hláška,
           do konzole ale napíšu, co konkrétně chybí, ať se to dá dohledat. */
        if(o.status === 404){
          console.warn('Chybí ' + soubor + '. Spusť workflow Aktualizace dat ze soutěže.');
          hlaska(telo, 'Data se připravují, mrkněte sem za chvíli.', sloupcu);
          return null;
        }
        if(!o.ok) throw new Error(o.status);
        return o.json();
      })
      .then(function(data){
        if(!data) return;
        var radku = vykresli(data, telo);
        if(!radku) hlaska(telo, prazdne, sloupcu);
        else razitko(telo, data.aktualizovano);
      })
      .catch(function(){
        hlaska(telo, 'Data se teď nepodařilo načíst. Zkuste to za chvíli.', sloupcu);
      });
  }

  var tabulka = document.getElementById('tabulka');
  if(tabulka) nacti('tabulka.json', tabulka, 9, function(data, telo){
    var tymy = data.tymy || [];
    if(!tymy.length) return 0;
    telo.innerHTML = '';
    tymy.forEach(function(t){
      var tr = telo.insertRow();
      if(t.nas) tr.className = 'my';
      tr.appendChild(bunka(t.poradi + '.', 'cislo'));
      tr.appendChild(bunka(t.kratky || t.nazev));
      tr.appendChild(bunka(t.zapasy, 'cislo'));
      tr.appendChild(bunka(t.vyhry, 'cislo skryt-mobil'));
      tr.appendChild(bunka(t.vyhry_p, 'cislo skryt-mobil'));
      tr.appendChild(bunka(t.prohry_p, 'cislo skryt-mobil'));
      tr.appendChild(bunka(t.prohry, 'cislo skryt-mobil'));
      tr.appendChild(bunka(t.branky_vstrelene + ':' + t.branky_obdrzene, 'cislo skryt-mobil'));
      tr.appendChild(bunka(t.body, 'cislo'));
    });
    return tymy.length;
  }, 'Tabulka bude, jakmile se odehraje první kolo.');

  var hraci = document.getElementById('hraci');
  if(hraci) nacti('hraci.json', hraci, 6, function(data, telo){
    var lidi = data.hraci || [];
    if(!lidi.length) return 0;
    telo.innerHTML = '';
    lidi.forEach(function(h, i){
      var tr = telo.insertRow();
      tr.appendChild(bunka((i + 1) + '.', 'cislo'));
      tr.appendChild(bunka(h.jmeno));
      tr.appendChild(bunka(h.zapasy, 'cislo skryt-mobil'));
      tr.appendChild(bunka(h.branky, 'cislo'));
      tr.appendChild(bunka(h.asistence, 'cislo skryt-mobil'));
      tr.appendChild(bunka(h.body, 'cislo'));
    });
    return lidi.length;
  }, 'Bodování naskočí po prvním odehraném turnaji.');

  var zapasy = document.getElementById('zapasy');
  if(zapasy) nacti('zapasy.json', zapasy, 5, function(data, telo){
    var seznam = data.zapasy || [];
    if(!seznam.length) return 0;
    telo.innerHTML = '';
    seznam.forEach(function(z){
      var tr = telo.insertRow();
      tr.appendChild(bunka(datumCesky(z.datum)));
      tr.appendChild(bunka(z.cas, 'skryt-mobil'));
      tr.appendChild(bunka(z.souper));
      tr.appendChild(bunka(z.hala || '', 'skryt-mobil'));
      tr.appendChild(bunka(z.vysledek || '', 'cislo'));
    });
    return seznam.length;
  }, 'Rozpis zveřejní soutěž před začátkem sezóny.');
})();

/* ---------- stránka Mládež: turnaje a tabulky z Orelské ligy ----------
   Data píše robot do orel.json. Sloupce tabulky se berou tak, jak je
   liga vypíše, takže se nic nerozbije, když je někdy přejmenuje. */
(function(){
  if(!document.querySelector('[id^="turnaje-"]')) return;

  var odkazStylu = document.querySelector('link[rel="stylesheet"][href$="styl.css"]');
  var ZDROJ = odkazStylu ? odkazStylu.getAttribute('href').replace(/styl\.css$/, '') : '';

  function bunka(radek, text, trida){
    var td = radek.insertCell();
    td.textContent = text;
    if(trida) td.className = trida;
    return td;
  }
  function hlaska(telo, text, sloupcu){
    telo.innerHTML = '';
    var td = telo.insertRow().insertCell();
    td.colSpan = sloupcu; td.style.textAlign = 'center'; td.style.padding = '26px';
    td.textContent = text;
  }
  function datum(iso){
    var d = iso.split('-');
    return Number(d[2]) + '. ' + Number(d[1]) + '. ' + d[0];
  }
  // sloupce s čísly zarovnám doprava, stejně jako u mužů
  function jeCislo(text){ return /^[\d\s.:+\-]+$/.test(text) && text.trim() !== ''; }

  fetch(ZDROJ + 'orel.json')
    .then(function(o){
      if(o.status === 404){ console.warn('Chybí orel.json. Spusť workflow Aktualizace dat ze soutěže.'); return null; }
      if(!o.ok) throw new Error(o.status);
      return o.json();
    })
    .then(function(data){
      Object.keys({'mladsi-zaci':1,'dorostenci':1}).forEach(function(klic){
        var turnaje = document.getElementById('turnaje-' + klic);
        var telo = document.getElementById('tabulka-' + klic);
        var hlava = document.getElementById('hlava-' + klic);
        if(!turnaje || !telo) return;

        var k = data && data.kategorie && data.kategorie[klic];
        if(!k){
          hlaska(turnaje, 'Data se připravují, mrkněte sem za chvíli.', 3);
          hlaska(telo, 'Data se připravují, mrkněte sem za chvíli.', 1);
          return;
        }

        // turnaje
        if(!k.turnaje || !k.turnaje.length){
          hlaska(turnaje, 'Další turnaje zatím nejsou vypsané.', 3);
        } else {
          turnaje.innerHTML = '';
          k.turnaje.forEach(function(t){
            var r = turnaje.insertRow();
            if(t.v_kurimi) r.className = 'my';
            var d = bunka(r, '');
            var a = document.createElement('a');
            a.href = t.odkaz; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = datum(t.datum);
            d.appendChild(a);
            bunka(r, t.poradatel);
            bunka(r, t.hala, 'skryt-mobil');
          });
        }

        // tabulka
        var tab = k.tabulka;
        if(!tab || !tab.radky || !tab.radky.length){
          if(hlava) hlava.innerHTML = '';
          hlaska(telo, 'Tabulka bude po prvním odehraném turnaji.', 1);
          return;
        }
        // sloupce, které se na mobil nevejdou: všechny kromě pořadí, týmu a posledního
        var posledni = tab.sloupce.length - 1;
        function tridaSloupce(i, text){
          var t = [];
          if(i > 1 && i < posledni) t.push('skryt-mobil');
          if(jeCislo(text)) t.push('cislo');
          return t.join(' ');
        }
        hlava.innerHTML = '';
        var hr = hlava.insertRow();
        tab.sloupce.forEach(function(s, i){
          var th = document.createElement('th');
          th.textContent = s;
          var vzorek = tab.radky[0][i] || '';
          th.className = tridaSloupce(i, vzorek);
          hr.appendChild(th);
        });
        telo.innerHTML = '';
        tab.radky.forEach(function(radek, ri){
          var r = telo.insertRow();
          if(ri === tab.nas) r.className = 'my';
          radek.forEach(function(text, i){ bunka(r, text, tridaSloupce(i, text)); });
        });
      });
    })
    .catch(function(){
      document.querySelectorAll('[id^="turnaje-"],[id^="tabulka-"]').forEach(function(t){
        hlaska(t, 'Data se teď nepodařilo načíst. Zkuste to za chvíli.', 3);
      });
    });
})();
