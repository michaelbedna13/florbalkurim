/* Přihláška na kemp. Odesílá se přes službu FormSubmit, která ji pošle
   e-mailem vedoucímu kempu, přílohu přepošle a nikde nic neukládá. */
(function(){
  var formular = document.getElementById('prihlaska');
  if(!formular) return;

  var UZAVERKA = new Date('2027-02-28T23:59:59+01:00');   // poslední den přihlášek
  var MAX_SOUBOR = 5 * 1024 * 1024;

  function ukaz(id){
    formular.style.display = 'none';
    document.getElementById(id).classList.add('ukazat');
  }

  // po odeslání se služba vrátí sem s ?odeslano=1
  if(location.search.indexOf('odeslano=1') !== -1){ ukaz('odeslano'); return; }
  if(new Date() > UZAVERKA){ ukaz('uzavreno'); return; }

  // kam se má služba po odeslání vrátit, musí to být celá adresa
  formular.querySelector('[name="_next"]').value =
    location.origin + location.pathname + '?odeslano=1';

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

  formular.addEventListener('submit', function(e){
    var soubor = formular.querySelector('input[type="file"]');
    if(soubor.files[0] && soubor.files[0].size > MAX_SOUBOR){
      e.preventDefault();
      alert('Kartička je moc velká, nejvýš 5 MB. Zkuste ji vyfotit znovu nebo ji zmenšit.');
      return;
    }

    // zaškrtnuté souhlasy přepíšu do skrytých polí, ať v e-mailu stojí ANO i NE
    formular.querySelectorAll('[data-souhlas]').forEach(function(z){
      formular.querySelector('input[type="hidden"][name="' + z.dataset.souhlas + '"]').value =
        z.checked ? 'ANO' : 'NE';
    });

    // datum narození česky, ne ve tvaru 2016-05-14
    var n = document.getElementById('f-narozeni').value.split('-');
    if(n.length === 3){
      formular.querySelector('[name="Datum narození"]').value =
        Number(n[2]) + '. ' + Number(n[1]) + '. ' + n[0];
    }

    var d = new Date();
    formular.querySelector('[name="Odesláno"]').value =
      d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + ' ' +
      d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');

    var tl = formular.querySelector('button[type="submit"]');
    tl.disabled = true;
    tl.textContent = 'Odesílám…';
  });
})();
