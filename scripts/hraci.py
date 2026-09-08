#!/usr/bin/env python3
"""
Stáhne statistiky hráčů a brankářů Florbalu Kuřim
a uloží je jako hraci.json.

Pozor: než se odehraje první turnaj, jsou tabulky na webu prázdné.
Skript to pozná a soubor nechá s prázdnými seznamy, aby appka
mohla klidně spadnout zpátky na docházku.
"""

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

URL = "https://repre.ceskyflorbal.cz/team/detail/statistics/44265"
VYSTUP = "hraci.json"
HLAVICKA = {"User-Agent": "FlorbalKurim-klubova-appka/1.0 (interni pouziti)"}

# název sloupce na webu -> klíč v JSONu
HRACI_SLOUPCE = {
    "Z": "zapasy", "B": "branky", "A": "asistence", "KB": "body",
    "TM": "trestne", "S": "strely", "+/-": "plusminus",
}
BRANKARI_SLOUPCE = {
    "Z": "zapasy", "ZCH": "odchytane", "MIN": "minuty", "BO": "obdrzene",
    "ø BO": "prumer_obdrzenych", "SO": "cista_konta", "V": "vyhry",
}


def bez_diakritiky(text):
    rozlozene = unicodedata.normalize("NFD", text or "")
    return "".join(z for z in rozlozene if unicodedata.category(z) != "Mn")


def klic_jmena(jmeno):
    """'Bednář Michael' i 'Michael Bednář' dají stejný klíč."""
    slova = re.findall(r"\w+", bez_diakritiky(jmeno).lower(), flags=re.UNICODE)
    return " ".join(sorted(slova))


def cislo(text):
    t = (text or "").strip().replace("−", "-").replace("%", "").replace(",", ".")
    m = re.search(r"-?\d+(\.\d+)?", t)
    if not m:
        return 0
    h = float(m.group())
    return int(h) if h == int(h) else round(h, 1)


def hlavicky(tabulka):
    return [b.get_text(" ", strip=True) for b in tabulka.find_all("th")]


def zpracuj_tabulku(tabulka, mapa_sloupcu):
    hlav = hlavicky(tabulka)
    poradi = {n: i for i, n in enumerate(hlav)}
    if "Jméno" not in poradi:
        return []

    radky = []
    telo = tabulka.find("tbody") or tabulka
    for tr in telo.find_all("tr"):
        bunky = tr.find_all("td")
        if len(bunky) < 4:
            continue
        jmeno = bunky[poradi["Jméno"]].get_text(" ", strip=True)
        if not jmeno or "nejsou žádná data" in jmeno:
            continue

        zaznam = {"jmeno": jmeno, "klic": klic_jmena(jmeno)}
        if "Post" in poradi and poradi["Post"] < len(bunky):
            zaznam["post"] = bunky[poradi["Post"]].get_text(strip=True)

        for nazev, klic in mapa_sloupcu.items():
            i = poradi.get(nazev)
            zaznam[klic] = cislo(bunky[i].get_text()) if i is not None and i < len(bunky) else 0
        radky.append(zaznam)
    return radky


def zpracuj(html):
    soup = BeautifulSoup(html, "html.parser")
    hraci, brankari = [], []

    for tabulka in soup.find_all("table"):
        hlav = hlavicky(tabulka)
        if "KB" in hlav and "Jméno" in hlav:
            hraci = zpracuj_tabulku(tabulka, HRACI_SLOUPCE)
        elif "SO" in hlav and "ZCH" in hlav:
            brankari = zpracuj_tabulku(tabulka, BRANKARI_SLOUPCE)

    hraci.sort(key=lambda h: (-h.get("body", 0), -h.get("branky", 0), h["jmeno"]))
    brankari.sort(key=lambda b: (-b.get("odchytane", 0), b["jmeno"]))
    return hraci, brankari


def main():
    odpoved = requests.get(URL, headers=HLAVICKA, timeout=30)
    odpoved.raise_for_status()

    hraci, brankari = zpracuj(odpoved.text)

    praha = timezone(timedelta(hours=1))
    data = {
        "aktualizovano": datetime.now(praha).isoformat(timespec="minutes"),
        "odkaz": URL,
        "hraci": hraci,
        "brankari": brankari,
    }
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    print(f"Uloženo {len(hraci)} hráčů a {len(brankari)} brankářů do {VYSTUP}")
    if not hraci and not brankari:
        print("  (tabulky jsou zatím prázdné — sezóna nezačala)")
    for h in hraci[:5]:
        print(f'  {h["jmeno"]:<22} {h.get("branky",0)}+{h.get("asistence",0)} = {h.get("body",0)} b')
    for b in brankari:
        print(f'  {b["jmeno"]:<22} {b.get("vyhry",0)} výher, '
              f'{b.get("cista_konta",0)} čistých kont, {b.get("obdrzene",0)} obdržených')


if __name__ == "__main__":
    sys.exit(main())
