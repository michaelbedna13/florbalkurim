#!/usr/bin/env python3
"""
Vybere fotky z galerie Florbalu Kuřim na Zoneramě, zmenší je a uloží
na web do fotky/galerie/. Seznam zapíše do galerie.json, ze kterého
se na úvodní stránce skládá karusel.

Fotky se ukládají přímo na web, aby se při návštěvě nic nenačítalo
ze Zoneramy. Web tak neposílá cizí službě IP adresy návštěvníků
a nedostane od ní cookies.

KTERÉ FOTKY SE UKÁŽOU
 * Když na Zoneramě existuje veřejné album s názvem "Na web", vezmou se
   fotky jen z něj. Tak máte plnou kontrolu, které děti jsou na webu vidět.
 * Když takové album není, vezme se rovnoměrný výběr z nejnovějšího alba.
 * Pro stránku Kempy se zvlášť vybírá z nejnovějšího alba, které má
   v názvu slovo „kemp“.

Poznámky ke stránkám Zoneramy:
 * Odkazy na fotky mají tvar /FlorbalKurim/Photo/<album>/<fotka>.
 * Obrázek v dané velikosti je na /photos/<fotka>_1024x768.jpg.
 * Název alba je v meta značce og:title na stránce alba.
"""

import io
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import requests
from PIL import Image

UCET = "FlorbalKurim"
ZAKLAD = "https://eu.zonerama.com"
VEREJNA_GALERIE = "https://FlorbalKurim.zonerama.com"
ALBUM_PRO_WEB = "na web"        # porovnává se bez ohledu na velikost písmen
POCET = 12
SLOZKA = "fotky/galerie"
VYSTUP = "galerie.json"
SIRKA = 1200                    # delší strana uložené fotky

HLAVICKA = {"User-Agent": "FlorbalKurim-klubovy-web/1.0 (interni pouziti)"}
FOTKA = re.compile(rf"/{UCET}/Photo/(\d+)/(\d+)", re.I)
ALBUM = re.compile(rf"/{UCET}/Album/(\d+)", re.I)
SLOZKA_ALB = re.compile(rf'href="(?:https?://[^"/]+)?/{UCET}/(\d+)"', re.I)
TITULEK = re.compile(r'<meta[^>]+property="og:title"[^>]+content="([^"]*)"', re.I)


def stahni(url):
    o = requests.get(url, headers=HLAVICKA, timeout=30)
    o.raise_for_status()
    return o.text


def fotky_alba(html, album_id):
    """Id fotek z daného alba v pořadí, jak jsou na stránce, bez opakování."""
    videne, ven = set(), []
    for alb, foto in FOTKA.findall(html):
        if alb == album_id and foto not in videne:
            videne.add(foto)
            ven.append(foto)
    return ven


def rovnomerne(seznam, kolik):
    if len(seznam) <= kolik:
        return list(seznam)
    krok = len(seznam) / kolik
    return [seznam[int(i * krok)] for i in range(kolik)]


def vyber():
    profil = stahni(f"{ZAKLAD}/{UCET}")

    # Nahoře na profilu jsou nejnovější fotky, takže jejich album je nejnovější.
    # Ostatní alba jsou schovaná ve složkách (třeba „Public Albums“), projdu i ty.
    alba = []
    def pridej(a):
        if a not in alba:
            alba.append(a)
    for alb, _ in FOTKA.findall(profil):
        pridej(alb)
    for a in ALBUM.findall(profil):
        pridej(a)
    for slozka in dict.fromkeys(SLOZKA_ALB.findall(profil)):
        try:
            for a in ALBUM.findall(stahni(f"{ZAKLAD}/{UCET}/{slozka}")):
                pridej(a)
        except Exception as e:
            print(f"   složku {slozka} se nepodařilo projít: {e}")
    if not alba:
        raise SystemExit("Na profilu jsem nenašel žádné album. Změnila se stránka Zoneramy?")

    nazvy, stranky = {}, {}
    for a in alba:
        html = stahni(f"{ZAKLAD}/{UCET}/Album/{a}")
        stranky[a] = html
        m = TITULEK.search(html)
        nazvy[a] = (m.group(1).strip() if m else f"Album {a}")
        print(f"   album {a}: {nazvy[a]}")

    vlastni = next((a for a in alba if nazvy[a].strip().lower() == ALBUM_PRO_WEB), None)
    if vlastni:
        album = vlastni
        fotky = fotky_alba(stranky[album], album)[:POCET * 2]
        print(f"Úvodní stránka: album „{nazvy[album]}“, je určené pro web.")
    else:
        album = alba[0]
        fotky = rovnomerne(fotky_alba(stranky[album], album), POCET)
        print(f"Úvodní stránka: album „Na web“ není, beru výběr z nejnovějšího „{nazvy[album]}“.")
    if not fotky:
        raise SystemExit(f"V albu {album} jsem nenašel žádné fotky.")

    # stránka Kempy: nejnovější album, které má v názvu „kemp“
    kemp = next((a for a in alba
                 if "kemp" in nazvy[a].lower() and nazvy[a].strip().lower() != ALBUM_PRO_WEB), None)
    kemp_fotky = rovnomerne(fotky_alba(stranky[kemp], kemp), POCET) if kemp else []
    if kemp:
        print(f"Stránka Kempy: výběr z alba „{nazvy[kemp]}“.")
    else:
        print("Stránka Kempy: album s „kemp“ v názvu není, ukáže se výběr z úvodní stránky.")

    return (album, nazvy[album], fotky), (kemp, nazvy.get(kemp), kemp_fotky)


def uloz_fotku(foto_id):
    cil = os.path.join(SLOZKA, f"{foto_id}.webp")
    if os.path.exists(cil):
        return cil
    o = requests.get(f"{ZAKLAD}/photos/{foto_id}_1024x768.jpg", headers=HLAVICKA, timeout=60)
    o.raise_for_status()
    im = Image.open(io.BytesIO(o.content)).convert("RGB")
    im.thumbnail((SIRKA, SIRKA), Image.LANCZOS)
    im.save(cil, "WEBP", quality=80, method=6)
    return cil


def stahni_sadu(album, fotky):
    ulozene = []
    for f in fotky:
        try:
            ulozene.append(uloz_fotku(f))
        except Exception as e:
            print(f"   fotku {f} se nepodařilo stáhnout: {e}")
    return [{"soubor": c.replace(os.sep, "/"),
             "odkaz": f"{ZAKLAD}/{UCET}/Photo/{album}/{os.path.basename(c)[:-5]}"}
            for c in ulozene]


def main():
    os.makedirs(SLOZKA, exist_ok=True)
    (album, nazev, fotky), (kemp, kemp_nazev, kemp_fotky) = vyber()

    hlavni = stahni_sadu(album, fotky)
    if not hlavni:
        raise SystemExit("Nepodařilo se stáhnout ani jednu fotku, galerie.json nechávám beze změny.")
    kempove = stahni_sadu(kemp, kemp_fotky) if kemp else []

    # staré fotky, které už v žádném výběru nejsou, smažu, ať web nebobtná
    potreba = {f["soubor"] for f in hlavni + kempove}
    for soubor in os.listdir(SLOZKA):
        cesta = f"{SLOZKA}/{soubor}"
        if cesta not in potreba:
            os.remove(os.path.join(SLOZKA, soubor))

    praha = timezone(timedelta(hours=1))
    data = {
        "aktualizovano": datetime.now(praha).isoformat(timespec="minutes"),
        "galerie": VEREJNA_GALERIE,
        "album": {"nazev": nazev, "odkaz": f"{ZAKLAD}/{UCET}/Album/{album}"},
        "fotky": hlavni,
        "kemp": ({"album": {"nazev": kemp_nazev, "odkaz": f"{ZAKLAD}/{UCET}/Album/{kemp}"},
                  "fotky": kempove} if kempove else None),
    }
    ulozene = hlavni + kempove
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"Uloženo {len(hlavni)} fotek pro úvodní stránku a {len(kempove)} pro Kempy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
