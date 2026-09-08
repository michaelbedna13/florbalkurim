#!/usr/bin/env python3
"""
Stáhne rozpis zápasů Florbalu Kuřim z webu Českého florbalu
a uloží ho jako zapasy.json do kořene repozitáře.

Spouští se přes GitHub Actions, ne ručně.

Poznámky ke stránce, ať se v tom příště hned vyznáš:
 * Zápasy NEJSOU v tabulce, jsou to bloky pod sebou. Skript se proto chytá
   odkazů, které jsou spolehlivé: /match/detail/... a /team/detail/overview/<id>.
 * U data chybí rok, na stránce je jen "NE, 20. 9. 1. kolo". Rok se dopočítá
   ze sezóny v nadpisu (srpen až prosinec první rok, leden až červenec druhý).
 * Nenasazený zápas má čas 00:00. Ukládá se jako prázdný.
 * Ve stejném místě, kde je před zápasem čas, bývá po zápase výsledek.
   Skript to rozliší podle tvaru a co vyhodnotí jako výsledek, vypíše do logu,
   ať se to dá po prvním kole zkontrolovat.
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------
# NASTAVENÍ — po skončení sezóny se tady nemění nic
# ------------------------------------------------------------
NAS_TYM_ID = "44265"          # Florbal Kuřim
URL = f"https://repre.ceskyflorbal.cz/team/detail/matches/{NAS_TYM_ID}"
VYSTUP = "zapasy.json"

HLAVICKA = {"User-Agent": "FlorbalKurim-klubovy-web/1.0 (interni pouziti)"}

# Krátké názvy soupeřů, stejná tabulka jako v tabulka.py.
KRATKE = {
    "44336": "Aligators", "44944": "Pohořelice", "44265": "Kuřim",
    "45560": "Hornets", "43962": "Galaxy Židenice", "45694": "Bojanovice",
    "46290": "Shooters Beta", "45741": "Gullivers", "46135": "Letovice",
    "45818": "Troopers", "46604": "VUT Brno",
}

DATUM = re.compile(r"(\d{1,2})\s*\.\s*(\d{1,2})\s*\.")
KOLO = re.compile(r"(\d{1,2})\s*\.\s*kolo")
SEZONA = re.compile(r"(20\d{2})\s*/\s*(20\d{2})")
CAS_NEBO_SKORE = re.compile(r"^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$")


def kratky_nazev(tym_id, plny):
    if tym_id in KRATKE:
        return KRATKE[tym_id]
    slova = plny.split()
    return " ".join(slova[:2]) if len(slova) > 2 else plny


def sezona(soup):
    """Vrátí rok, kterým sezóna začíná. Bez nadpisu odhadne podle dneška."""
    m = SEZONA.search(soup.get_text(" ", strip=True))
    if m:
        return int(m.group(1))
    dnes = datetime.now()
    return dnes.year if dnes.month >= 7 else dnes.year - 1


def blok_zapasu(odkaz):
    """Nejbližší předek, ve kterém jsou aspoň dva různé týmy."""
    uzel = odkaz
    for _ in range(8):
        uzel = uzel.parent
        if uzel is None:
            return None
        tymy = tymy_v(uzel)
        if len(tymy) >= 2:
            return uzel
    return None


def tymy_v(uzel):
    """[(id, název), ...] v pořadí, jak jsou v bloku, bez opakování."""
    ven = []
    for a in uzel.find_all("a", href=re.compile(r"/team/detail/overview/\d+")):
        text = a.get_text(" ", strip=True)
        if not text:
            continue
        tym_id = re.search(r"/team/detail/overview/(\d+)", a["href"]).group(1)
        if ven and ven[-1][0] == tym_id:
            continue
        ven.append((tym_id, text))
    return ven


def cisty_nazev(text):
    """'Florbal Kuřim Kuřim KUR' -> 'Florbal Kuřim' (odkaz nese víc variant)."""
    m = re.match(r"^(.*?)\s+\S+\s+[A-ZŠČŘŽÝÁÍÉŤĎŇŮÚ]{2,4}\s*$", text)
    return (m.group(1) if m else text).strip()


def hledej_datum(uzel):
    """Datum bývá v hlavičce bloku, případně o patro výš."""
    for _ in range(4):
        if uzel is None:
            return None, None
        text = uzel.get_text(" ", strip=True)
        d = DATUM.search(text)
        if d:
            k = KOLO.search(text)
            return (int(d.group(1)), int(d.group(2))), (int(k.group(1)) if k else None)
        uzel = uzel.parent
    return None, None


def zpracuj(html):
    soup = BeautifulSoup(html, "html.parser")
    rok_sezony = sezona(soup)
    zapasy, podezrele = [], []

    for odkaz in soup.find_all("a", href=re.compile(r"/match/detail/")):
        blok = blok_zapasu(odkaz)
        if blok is None:
            continue

        tymy = tymy_v(blok)
        if len(tymy) < 2 or NAS_TYM_ID not in (tymy[0][0], tymy[1][0]):
            continue

        (den_mesic, kolo) = hledej_datum(blok)
        if den_mesic is None:
            continue
        den, mesic = den_mesic
        rok = rok_sezony if mesic >= 8 else rok_sezony + 1

        doma = tymy[0][0] == NAS_TYM_ID
        souper_id, souper_text = tymy[1] if doma else tymy[0]
        souper_plny = cisty_nazev(souper_text)

        # čas nebo výsledek
        cas, vysledek = "", None
        m = CAS_NEBO_SKORE.match(odkaz.get_text(" ", strip=True))
        if m:
            a, b = int(m.group(1)), m.group(2)
            je_cas = len(b) == 2 and a <= 23 and int(b) <= 59
            if je_cas:
                cas = "" if (a == 0 and int(b) == 0) else f"{a:02d}:{b}"
            else:
                vysledek = f"{a}:{int(b)}"
                podezrele.append((f"{den}.{mesic}.", souper_plny, vysledek))

        # hala bývá posledním řádkem bloku
        radky = [r.strip() for r in blok.get_text("\n", strip=True).split("\n") if r.strip()]
        hala = radky[-1] if radky else ""
        if CAS_NEBO_SKORE.match(hala) or DATUM.search(hala):
            hala = ""

        zapasy.append({
            "datum": f"{rok:04d}-{mesic:02d}-{den:02d}",
            "cas": cas,
            "kolo": kolo,
            "souper": kratky_nazev(souper_id, souper_plny),
            "souper_plny": souper_plny,
            "doma": doma,
            "hala": hala,
            "vysledek": vysledek,
            "odehrano": vysledek is not None,
        })

    # bloky se na stránce opakují (mobilní a stolní varianta), tak bez duplicit
    videne, unikatni = set(), []
    for z in zapasy:
        klic = (z["datum"], z["souper"], z["doma"], z["cas"])
        if klic in videne:
            continue
        videne.add(klic)
        unikatni.append(z)
    unikatni.sort(key=lambda z: (z["datum"], z["cas"] or "99:99"))

    return unikatni, rok_sezony, podezrele


def main():
    odpoved = requests.get(URL, headers=HLAVICKA, timeout=30)
    odpoved.raise_for_status()

    zapasy, rok, podezrele = zpracuj(odpoved.text)

    if not zapasy:
        raise SystemExit(
            "Nenašel jsem ani jeden zápas. Buď se změnila struktura stránky,\n"
            f"nebo je špatně adresa {URL}. Soubor {VYSTUP} zůstal beze změny."
        )

    praha = timezone(timedelta(hours=1))
    data = {
        "aktualizovano": datetime.now(praha).isoformat(timespec="minutes"),
        "sezona": f"{rok}/{rok + 1}",
        "odkaz": URL,
        "zapasy": zapasy,
    }
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    odehrano = sum(1 for z in zapasy if z["odehrano"])
    print(f"Uloženo {len(zapasy)} zápasů sezóny {rok}/{rok + 1} do {VYSTUP} "
          f"({odehrano} odehraných)")
    for z in zapasy:
        kde = "doma " if z["doma"] else "venku"
        print(f'  {z["datum"]} {z["cas"] or "  ?  ":>5}  {kde}  '
              f'{z["souper"]:<16} {z["vysledek"] or ""}   {z["hala"]}')

    if podezrele:
        print("\nTohle jsem vyhodnotil jako výsledek, zkontroluj to prosím:")
        for d, s, v in podezrele:
            print(f"   {d} {s}: {v}")


if __name__ == "__main__":
    sys.exit(main())
