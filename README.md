# florbalkurim.cz

Statický web spolku. Žádný build, žádné npm — jen HTML, jeden CSS a devět řádků JS.
Nahrává se do repozitáře a servíruje přes GitHub Pages.

## Struktura

```
index.html              domů — nábor
treninky/index.html     rozvrh všech kategorií
muzi/index.html         áčko, tabulka a bodování
kempy-a-tabory/index.html
o-nas/index.html        historie klubu
kontakty/index.html
styl.css                celý vzhled, jeden soubor
web.js                  mobilní menu + zástupná místa za chybějící fotky
logo.svg                ZÁSTUPNÉ — nahradit logem z repozitáře appky
fotky/                  fotky, viz níž
CNAME                   doména (vytvořit při nasazení)
```

Adresy `/treninky/`, `/o-nas/`, `/kempy-a-tabory/` a `/kontakty/` jsou stejné jako
na starém WordPressu — proto ty složky. Nepřejmenovávat, přišli bychom o pozice
ve vyhledávání.

## Co doplnit

Všechna nedoplněná místa jsou v kódu ve značce `<span class="doplnit">`
a v prohlížeči svítí modře. Najdeš je hledáním slova `doplnit`.

- **Kategorie**: dny a časy, jméno trenéra a telefon. Jsou na dvou místech,
  v `index.html` (tři karty) a v `treninky/index.html` (čtyři i s muži).
  Věkové rozpětí se drží v atributu `data-vek="6-10"`. Ročníky se z něj počítají
  samy, viz níž.
- **Telefony trenérů** — v odkazu je prázdné `href="tel:"`, doplnit i tam.
- **Kontakty** — u tří lidí chybí funkce v klubu, případně číslo účtu.
- **Kemp** — termín, cena, kdo ho vede, co je v ceně.
- **Hala** — kudy se jde dovnitř a kde se parkuje.
- **Flickr** — všude je `https://www.flickr.com/`, nahradit adresou galerie
  (je v každém souboru dvakrát: v menu a v patičce).

## Ročníky se posouvají samy

Ročníky u kategorií ani označení sezóny se neudržují ručně. Skript v `web.js`
si spočítá, která sezóna běží (láme se v červenci), a z věkového rozpětí
v `data-vek` dopočítá ročníky. Každý rok se to posune bez zásahu.

Ručně se mění jen samotné rozpětí věku, když se kategorie přeskupí.
A jednou si ověř, že vypočtené ročníky sedí s tím, jak je dělí soutěž.

## Fotky

Do `fotky/`, dokud tam nejsou, ukazuje web pruhované místo s popisem, co tam patří.

Formát JPG, barevný profil sRGB. Názvy přesně podle tabulky, malými písmeny,
bez diakritiky a mezer.

| soubor | kde | poměr |
|---|---|---|
| `hero.jpg` | hlavička domů, přes celou šířku | široký, aspoň 1800 px |
| `trenink.jpg` | domů, „nic se nedomlouvá dopředu" | 4:3 |
| `kemp.jpg` | domů, kempy | 4:3 |
| `g1.jpg` `g2.jpg` `g3.jpg` | domů, pás galerie | čtverec |
| `hala.jpg` | tréninky a kontakty | 4:3 |
| `historie.jpg` | o nás | 4:3 |
| `ales-hanak.jpg` `petr-macek.jpg` `daniel-pysny.jpg` | kontakty, portréty | 4:3, obličej v horní třetině |
| `kemp1.jpg` `kemp2.jpg` `kemp3.jpg` | kempy, pás | čtverec |
| `kemp-velka.jpg` | kempy, velká | 4:3 |

Rozměry, na které je zmenšit před nahráním:

- široká `hero.jpg`: 2000 × 1200 px, do 400 kB
- fotky 4:3: 1400 × 1050 px, do 250 kB
- čtvercové do pásu: 1000 × 1000 px, do 200 kB
- portréty na kontakty: 900 × 675 px, obličej v horní třetině, do 200 kB

Nezmenšené fotky z foťáku mají klidně 6 MB a na mobilních datech před halou
by se stránka načítala půl minuty.

## Nasazení

1. Nový repozitář, obsah téhle složky do kořene.
2. Settings → Pages → větev `main`, složka `/`.
3. Do kořene soubor `CNAME` s jediným řádkem `florbalkurim.cz`.
4. U registrátora nasměrovat doménu na GitHub Pages (A záznamy + CNAME pro `www`).
5. Ve Wedosu nebo kde web běží teď nezapomenout starý WordPress vypnout,
   ať neběží dva weby naráz.

## Cesty k souborům

Odkazy na `styl.css`, `web.js`, logo a fotky jsou **relativní** (`styl.css`
z kořene, `../styl.css` z podsložek). Díky tomu web funguje na doméně,
na adrese `michaelbedna13.github.io/florbalkurim/` i po otevření souboru
z disku. Kdyby je někdo přepsal na `/styl.css`, přestane se načítat vzhled
všude kromě ostré domény.

## Na co pozor

**Menu a patička jsou v každém souboru zvlášť.** Když přidáš položku, musíš ji
přidat do všech šesti. Je to daň za to, že web nemá build.

**Z mobilu se do podsložek nahrává blbě.** Soubory `treninky/index.html` a spol.
patří do složek, ne do kořene.

**Tabulky na stránce Muži zatím nemají data.** Rozpis čeká na `zapasy.json`,
který zatím neexistuje a bude potřeba k němu dopsat stahovač. Tabulka a bodování
čekají na `tabulka.json` a `hraci.json`, které už dvakrát denně píše robot
v repozitáři appky.

**Ročníky u kategorií zestárnou.** Každý červen je posunout, jinak to za dva roky
dopadne jako starý web.

## Vzhled

Vychází z dresů, ne z klubových barev nasypaných na plochu.

- **Bílý venkovní dres** je základ webu — bílá plocha, přes ni diagonální
  šrafy a rastr teček (`.srafy`, `.rastr`).
- **Domácí modro-černý dres** je sekce mužů a výzvy — přechod od nebeské
  přes námořní do černi, se světlými šrafami.
- Věk u kategorií je vysázený jako číslo na dresu.

**Písma jsou stejná jako v appce** — Chakra Petch na nadpisy a čísla, Geist na text,
obojí z Google Fonts. Kdybys je chtěl mít doma kvůli GDPR (načítání z Googlu je
u nás sporné), stáhni si `.woff2` a nahraď odkaz v hlavičce vlastním `@font-face`.
Je to šest řádků a udělá se to jednou pro všech šest souborů.
