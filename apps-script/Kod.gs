/**
 * Přihlášky na kemp Florbal Kuřim
 * ------------------------------------------------------------
 * Skript běží jako webová aplikace nad Google tabulkou.
 * Přijme přihlášku z webu, zapíše ji do tabulky, kartičku pojišťovny
 * uloží do soukromé složky na Disku a pošle dva e-maily:
 * vedoucímu kempu přehled přihlášky a rodiči potvrzení.
 *
 * Nastavení je jen tady nahoře. Po každé změně kódu je potřeba
 * nasadit novou verzi (Nasadit, Spravovat nasazení, upravit, Nová verze).
 */

var NASTAVENI = {
  // ID Google tabulky, kam se přihlášky zapisují. Je v adrese tabulky mezi /d/ a /edit.
  // Když skript otevřeš přímo z tabulky (Rozšíření, Apps Script), může zůstat prázdné.
  tabulka: '',

  // kam chodí upozornění o nové přihlášce, víc adres odděl čárkou
  upozorneni: 'florbalkurim@gmail.com',
  // jméno odesílatele v e-mailech
  odesilatel: 'Florbal Kuřim',
  // kam má rodič odpovídat, když má dotaz
  odpovedi: 'florbalkurim@gmail.com',

  list: 'Přihlášky',
  slozka: 'Kemp 2027, kartičky pojišťovny',

  kemp: {
    termin: '26.–30. 7. 2027',
    cas: 'každý den od 8:00 do 16:00',
    cena: '4 500 Kč',
    uzaverka: new Date('2027-02-28T23:59:59+01:00')
  },

  web: 'https://michaelbedna13.github.io/florbalkurim/',
  logo: 'https://michaelbedna13.github.io/florbalkurim/logo.svg'
};

// Pořadí sloupců v tabulce. Názvy odpovídají polím ve formuláři na webu.
var SLOUPCE = [
  'Odesláno', 'Jméno dítěte', 'Datum narození', 'Trénink', 'Bydliště',
  'Jméno rodiče', 'email', 'Telefon',
  'Alergie a zdravotní omezení', 'Léky během kempu', 'Plavec', 'Odchází samo',
  'Kartička pojišťovny',
  'Souhlas: zdravotní pojišťovna', 'Souhlas: fotografie a video', 'Souhlas: zdravotní údaje'
];
var POVINNE = ['Jméno dítěte', 'Datum narození', 'Trénink', 'Bydliště',
               'Jméno rodiče', 'email', 'Telefon', 'Plavec', 'Odchází samo'];
var ZDRAVOTNI = ['Alergie a zdravotní omezení', 'Léky během kempu'];


/* ============================================================
   Příjem přihlášky
   ============================================================ */

function doPost(e) {
  var zamek = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);

    // pole, které člověk nevidí; vyplní ho jen robot
    if (d._honey) return odpoved({ ok: true });

    if (new Date() > NASTAVENI.kemp.uzaverka) {
      return odpoved({ ok: false, chyba: 'Přihlášky jsou už uzavřené.' });
    }
    for (var i = 0; i < POVINNE.length; i++) {
      if (!String(d[POVINNE[i]] || '').trim()) {
        return odpoved({ ok: false, chyba: 'Chybí pole: ' + POVINNE[i] });
      }
    }

    zamek.waitLock(20000);

    // kartička pojišťovny do soukromé složky na Disku
    var odkazKarticky = '';
    if (d.karticka && d.karticka.data) {
      var nazev = (d['Jméno dítěte'] + ' ' + (d['Datum narození'] || '')).replace(/[^\wÀ-ž .-]/g, '').trim();
      var koncovka = /pdf/i.test(d.karticka.typ) ? '.pdf' : '.jpg';
      var soubor = slozka().createFile(
        Utilities.newBlob(Utilities.base64Decode(d.karticka.data), d.karticka.typ, nazev + koncovka));
      odkazKarticky = soubor.getUrl();
    }
    d['Kartička pojišťovny'] = odkazKarticky;

    var list = listPrihlasek();
    list.appendRow(SLOUPCE.map(function (s) { return bezVzorce(d[s]); }));

    zamek.releaseLock();

    posliVedoucimu(d, odkazKarticky);
    posliRodici(d);

    return odpoved({ ok: true });
  } catch (err) {
    console.error(err);
    return odpoved({ ok: false, chyba: 'Přihlášku se nepodařilo uložit.' });
  } finally {
    try { zamek.releaseLock(); } catch (x) {}
  }
}

// Otevřením adresy skriptu v prohlížeči se dá ověřit, že běží.
function doGet() {
  return ContentService.createTextOutput('Přihlášky na kemp Florbal Kuřim: skript běží.');
}

function odpoved(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   Tabulka a Disk
   ============================================================ */

function sesit() {
  if (NASTAVENI.tabulka) return SpreadsheetApp.openById(NASTAVENI.tabulka);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Skript neví, kam zapisovat. Vyplň nahoře v NASTAVENI řádek tabulka.');
  return ss;
}

function listPrihlasek() {
  var ss = sesit();
  var list = ss.getSheetByName(NASTAVENI.list);
  if (!list) {
    list = ss.insertSheet(NASTAVENI.list);
    list.appendRow(SLOUPCE);
    list.getRange(1, 1, 1, SLOUPCE.length)
      .setFontWeight('bold').setBackground('#0B1524').setFontColor('#FFFFFF');
    list.setFrozenRows(1);
  }
  return list;
}

function slozka() {
  var it = DriveApp.getFoldersByName(NASTAVENI.slozka);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NASTAVENI.slozka);
}

// Text začínající znaménkem by tabulka brala jako vzorec. Tomu se tady brání.
function bezVzorce(v) {
  v = (v === undefined || v === null) ? '' : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}


/* ============================================================
   E-maily
   ============================================================ */

function posliVedoucimu(d, odkazKarticky) {
  var radky = SLOUPCE.filter(function (s) { return s !== 'Kartička pojišťovny'; })
    .map(function (s) { return [nazevPole(s), d[s] || '']; });
  if (odkazKarticky) radky.push(['Kartička pojišťovny', '<a href="' + odkazKarticky + '" style="color:#16375C">otevřít na Disku</a>']);

  var obsah =
    odstavec('Přišla nová přihláška na letní kemp. Na rodiče stačí odpovědět na tento e-mail.') +
    tabulka(radky) +
    odstavec('<a href="' + sesit().getUrl() +
             '" style="color:#16375C;font-weight:bold">Otevřít tabulku přihlášek</a>');

  MailApp.sendEmail({
    to: NASTAVENI.upozorneni,
    subject: 'Nová přihláška na kemp: ' + d['Jméno dítěte'],
    name: NASTAVENI.odesilatel,
    replyTo: d.email,
    htmlBody: sablona('Nová přihláška na kemp', obsah)
  });
}

function posliRodici(d) {
  // Zdravotní údaje do potvrzení záměrně nevypisuji, e-mail je nejméně bezpečné místo.
  var radky = [
    ['Dítě', d['Jméno dítěte']],
    ['Datum narození', d['Datum narození']],
    ['Trénink', d['Trénink']],
    ['Rodič', d['Jméno rodiče'] + ', ' + d['Telefon']],
    ['Souhlas s fotkami a videem', d['Souhlas: fotografie a video']]
  ];
  var k = NASTAVENI.kemp;
  var obsah =
    odstavec('Dobrý den,') +
    odstavec('děkujeme, přihláška na letní kemp Florbalu Kuřim k nám dorazila. ' +
             'Ozveme se vám s dalšími informacemi a platebními údaji.') +
    tabulka(radky) +
    odstavec('<b>Kemp proběhne ' + k.termin + ', ' + k.cas + '.</b><br>Cena ' + k.cena + '.') +
    odstavec('Kdyby bylo v přihlášce něco špatně, stačí odpovědět na tento e-mail.') +
    odstavec('Florbal Kuřim');

  MailApp.sendEmail({
    to: d.email,
    subject: 'Přihláška na kemp Florbal Kuřim je přijatá',
    name: NASTAVENI.odesilatel,
    replyTo: NASTAVENI.odpovedi,
    htmlBody: sablona('Přihláška je přijatá', obsah)
  });
}

function nazevPole(s) {
  return s === 'email' ? 'E-mail' : s.replace('Souhlas: ', 'Souhlas, ');
}

function hlidat(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function odstavec(html) {
  return '<p style="margin:0 0 16px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#16375C">' + html + '</p>';
}

function tabulka(radky) {
  var r = radky.map(function (x, i) {
    var hodnota = /^<a /.test(x[1]) ? x[1] : hlidat(x[1] || '').replace(/\n/g, '<br>');
    return '<tr style="background:' + (i % 2 ? '#F1F6FB' : '#FFFFFF') + '">' +
      '<td style="padding:10px 12px;font:bold 13px/1.4 Arial,Helvetica,sans-serif;color:#16375C;' +
      'width:42%;vertical-align:top;border-bottom:1px solid #DCE6F0">' + hlidat(x[0]) + '</td>' +
      '<td style="padding:10px 12px;font:14px/1.45 Arial,Helvetica,sans-serif;color:#0B1524;' +
      'vertical-align:top;border-bottom:1px solid #DCE6F0">' + (hodnota || '&nbsp;') + '</td></tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="border-collapse:collapse;border:2px solid #0B1524;margin:0 0 22px">' + r + '</table>';
}

// Obal e-mailu v barvách klubu. Psané tabulkami a vloženými styly,
// protože e-mailové programy moderní CSS neumí.
function sablona(nadpis, obsah) {
  return '<!DOCTYPE html><html lang="cs"><body style="margin:0;padding:0;background:#F1F6FB">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F6FB">' +
    '<tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
    'style="max-width:600px;width:100%;background:#FFFFFF">' +
    '<tr><td style="background:#0B1524;padding:22px 28px">' +
    '<span style="font:bold 20px/1 Arial,Helvetica,sans-serif;letter-spacing:.04em;color:#FFFFFF">FLORBAL KUŘIM</span>' +
    '<br><span style="font:italic 15px/1.8 Georgia,serif;color:#7CB6E0">Víc než sport!</span></td></tr>' +
    '<tr><td style="height:6px;background:#7CB6E0;font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:30px 28px 10px">' +
    '<h1 style="margin:0 0 20px;font:bold 24px/1.2 Arial,Helvetica,sans-serif;text-transform:uppercase;color:#0B1524">' +
    hlidat(nadpis) + '</h1>' + obsah + '</td></tr>' +
    '<tr><td style="background:#0D2340;padding:18px 28px;font:13px/1.6 Arial,Helvetica,sans-serif;color:#AFC3D6">' +
    'Florbal Kuřim, z. s., Hybešova 1988/36, 664 34 Kuřim, IČO 22873040<br>' +
    '<a href="' + NASTAVENI.web + '" style="color:#7CB6E0">' + NASTAVENI.web.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</a>' +
    '</td></tr></table></td></tr></table></body></html>';
}


/* ============================================================
   Po kempu
   ============================================================ */

/**
 * Po skončení kempu spusť ručně (vyber v nabídce nahoře a dej Spustit).
 * Vymaže z tabulky zdravotní údaje a odkazy na kartičky a smaže složku
 * s kartičkami. Tak to slibují zásady ochrany osobních údajů.
 */
function smazatZdravotniUdajePoKempu() {
  var list = listPrihlasek();
  var posledni = list.getLastRow();
  if (posledni > 1) {
    ZDRAVOTNI.concat(['Kartička pojišťovny']).forEach(function (s) {
      var sloupec = SLOUPCE.indexOf(s) + 1;
      list.getRange(2, sloupec, posledni - 1, 1).clearContent();
    });
  }
  var it = DriveApp.getFoldersByName(NASTAVENI.slozka);
  while (it.hasNext()) it.next().setTrashed(true);
  console.log('Zdravotní údaje a kartičky jsou smazané.');
}

/** Pro vyzkoušení e-mailů bez vyplňování formuláře. Pošle obě zprávy na adresu upozornění. */
function zkusitEmaily() {
  var d = {
    'Jméno dítěte': 'Jan Zkušební', 'Datum narození': '14. 5. 2016', 'Trénink': 'Mladší žáci',
    'Bydliště': 'Tyršova 1, Kuřim', 'Jméno rodiče': 'Petra Zkušební', email: NASTAVENI.upozorneni,
    'Telefon': '777 123 456', 'Alergie a zdravotní omezení': 'pyl', 'Léky během kempu': '',
    'Plavec': 'plavec', 'Odchází samo': 'ne', 'Souhlas: zdravotní pojišťovna': 'NE',
    'Souhlas: fotografie a video': 'ANO', 'Souhlas: zdravotní údaje': 'ANO', 'Odesláno': 'zkouška'
  };
  posliVedoucimu(d, '');
  posliRodici(d);
}
