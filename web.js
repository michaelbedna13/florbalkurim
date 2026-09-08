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

/* ---------- tabulky na stránce Muži ----------
   Data píše dvakrát denně robot v repozitáři appky, tenhle web si je
   jen stahuje. Jeden zdroj pravdy, žádná druhá kopie stahovačů. */
(function(){
  var ZDROJ = 'https://raw.githubusercontent.com/michaelbedna13/florbal-kurim/main/';

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
        /* 404 znamená, že soubor ještě nevznikl, ne poruchu */
        if(o.status === 404){ hlaska(telo, prazdne, sloupcu); return null; }
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
      tr.appendChild(bunka(z.doma ? 'doma' : 'venku', 'skryt-mobil'));
      tr.appendChild(bunka(z.vysledek || '', 'cislo'));
    });
    return seznam.length;
  }, 'Rozpis zveřejní soutěž před začátkem sezóny.');
})();
