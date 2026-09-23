#!/usr/bin/env python3
"""
Stáhne turnaje a tabulky mládeže z Orelské florbalové ligy (orelskafl.cz)
a uloží je jako orel.json do kořene repozitáře.

Spouští se přes GitHub Actions spolu s ostatními stahovači.

Poznámky ke stránkám OFL, ať se v tom příště hned vyznáš:
 * Mládež hraje turnaje, ne jednotlivé zápasy. Kalendář ukazuje jen
   neodehrané turnaje, odehrané z něj samy mizí. Přesně to chceme.
 * V kalendáři má každý turnaj odkaz s atributem title ve tvaru
   "Mladší žáci · Západ · Pořadatel · Hala". Z něj se bere pořadatel a hala,
   datum z textu odkazu ve výpisu.
 * Tabulka divize se objeví až po prvním turnaji. Názvy sloupců neznám,
   tak se převezmou tak, jak je liga vypíše, a web je jen zobrazí.
 * Kuřim tam vystupuje jako "Orel Kuřim".
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

ZAKLAD = "https://www.orelskafl.cz/web/index.php"
VYSTUP = "orel.json"
NAS_TYM = "Kuřim"

KATEGORIE = [
    {"klic": "mladsi-zaci", "nazev": "Mladší žáci", "category": 3, "division": 3},
    {"klic": "dorostenci",  "nazev": "Dorostenci",  "category": 5, "division": 3},
]

HLAVICKA = {"User-Agent": "FlorbalKurim-klubovy-web/1.0 (interni pouziti)"}
DATUM = re.compile(r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})")
PRAZDNA_TABULKA = "není k dispozici žádná tabulka"


def stahni(parametry):
    odpoved = requests.get(ZAKLAD, params=parametry, headers=HLAVICKA, timeout=30)
    odpoved.raise_for_status()
    return odpoved.text, odpoved.url


def id_turnaje(href):
    m = re.search(r"tournamentdetail(?:&|&amp;|%26)id=(\d+)", href or "")
    return m.group(1) if m else None


def turnaje(html):
    soup = BeautifulSoup(html, "html.parser")
    data = {}

    for a in soup.find_all("a", href=re.compile(r"tournamentdetail")):
        tid = id_turnaje(a.get("href"))
        if not tid:
            continue
        zaznam = data.setdefault(tid, {"id": tid})

        # datum z textu odkazu ve výpisu
        d = DATUM.search(a.get_text(" ", strip=True))
        if d and "datum" not in zaznam:
            den, mesic, rok = (int(x) for x in d.groups())
            zaznam["datum"] = f"{rok:04d}-{mesic:02d}-{den:02d}"

        # pořadatel a hala z atributu title v mřížce kalendáře
        titulek = a.get("title") or ""
        casti = [c.strip() for c in titulek.split("·")]
        if len(casti) >= 4:
            zaznam["poradatel"] = casti[2]
            zaznam["hala"] = casti[3]

    ven = []
    for z in data.values():
        if "datum" not in z:
            continue
        z.setdefault("poradatel", "")
        z.setdefault("hala", "")
        z["v_kurimi"] = NAS_TYM in z["hala"]
        z["poradame"] = NAS_TYM in z["poradatel"]
        z["odkaz"] = f"{ZAKLAD}?r=site%2Ftournamentdetail&id={z['id']}"
        ven.append(z)
    ven.sort(key=lambda z: z["datum"])
    return ven


def tabulka(html):
    """Vrátí {'sloupce': [...], 'radky': [[...]], 'nas': index} nebo None."""
    if PRAZDNA_TABULKA in html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    for t in soup.find_all("table"):
        hlavicka = [th.get_text(" ", strip=True) for th in t.find_all("th")]
        telo = t.find("tbody") or t
        radky = []
        for tr in telo.find_all("tr"):
            bunky = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if bunky and any(bunky):
                radky.append(bunky)
        # hledám tu tabulku, ve které jsou týmy, ne kalendář ani rozcestník
        if len(radky) >= 2 and any(NAS_TYM in " ".join(r) or "Orel" in " ".join(r) for r in radky):
            nas = next((i for i, r in enumerate(radky) if NAS_TYM in " ".join(r)), None)
            sirka = max(len(r) for r in radky)
            if len(hlavicka) != sirka:
                hlavicka = (hlavicka + [""] * sirka)[:sirka]
            return {"sloupce": hlavicka, "radky": radky, "nas": nas}

    print("   Varování: na stránce tabulky jsem žádnou tabulku týmů nenašel.")
    return None


def main():
    praha = timezone(timedelta(hours=1))
    vysledek = {
        "aktualizovano": datetime.now(praha).isoformat(timespec="minutes"),
        "kategorie": {},
    }

    for k in KATEGORIE:
        print(f"{k['nazev']}:")

        html, url_kalendar = stahni({"r": "site/calendar",
                                     "f_category": k["category"], "f_division": k["division"]})
        seznam = turnaje(html)
        print(f"   turnajů před námi: {len(seznam)}")
        for z in seznam:
            doma = "  (v Kuřimi)" if z["v_kurimi"] else ""
            print(f"     {z['datum']}  {z['poradatel']:<28} {z['hala']}{doma}")

        html, url_tabulka = stahni({"r": "site/season-table",
                                    "category_id": k["category"], "division_id": k["division"]})
        tab = tabulka(html)
        if tab:
            print(f"   tabulka: {len(tab['radky'])} týmů, sloupce {tab['sloupce']}")
        else:
            print("   tabulka: zatím není")

        vysledek["kategorie"][k["klic"]] = {
            "nazev": k["nazev"],
            "turnaje": seznam,
            "tabulka": tab,
            "odkaz_kalendar": url_kalendar,
            "odkaz_tabulka": url_tabulka,
        }

    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(vysledek, f, ensure_ascii=False, indent=1)
    print(f"Uloženo do {VYSTUP}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
