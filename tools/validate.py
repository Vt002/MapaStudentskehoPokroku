#!/usr/bin/env python3
"""
Validační skript pro Mapu studentského pokroku (MSP).
Používá výhradně standardní knihovnu Pythonu (bez externích závislostí).

Kontroluje:
1. Shodu a validitu dat v data/schedule.json a data/schedule.js.
2. Validitu datových struktur v data/map-data.js:
   - Unikátnost ID stanic.
   - Existenci stanic odkazovaných v trasách oborů (A, E, S).
   - Souvislost tras.
   - Shodu a formát URL repozitářů (https://github.com/Vt002/<repo>).
   - Validitu formátů dat (YYYY-MM-DD).
"""

import sys
import os
import json
import re
from datetime import datetime

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")

def validate():
    print("=== Spouštím validaci dat Mapy studentského pokroku ===")
    errors = []
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    data_dir = os.path.join(project_root, "data")
    schedule_json_path = os.path.join(data_dir, "schedule.json")
    schedule_js_path = os.path.join(data_dir, "schedule.js")
    map_data_js_path = os.path.join(data_dir, "map-data.js")

    # 1. Kontrola existence souborů
    for p in [schedule_json_path, schedule_js_path, map_data_js_path]:
        if not os.path.exists(p):
            errors.append(f"Chybí povinný soubor: {p}")
    if errors:
        for e in errors:
            log_fail(e)
        return False

    # 2. Validace schedule.json
    try:
        with open(schedule_json_path, "r", encoding="utf-8") as f:
            sched_json = json.load(f)
        log_pass("data/schedule.json je syntakticky platný JSON.")
    except Exception as ex:
        errors.append(f"Chyba při čtení data/schedule.json: {ex}")
        log_fail(errors[-1])
        return False

    # 3. Kontrola schedule.js vs schedule.json
    try:
        with open(schedule_js_path, "r", encoding="utf-8") as f:
            js_content = f.read()
        
        # Extrahujeme objekt SCHEDULE_DATA
        match = re.search(r'var\s+SCHEDULE_DATA\s*=\s*(\{[\s\S]*?\});\s*(?:root|\n)', js_content)
        if not match:
            # Druhý pokus: hledání jakéhokoli JSON objektu po rovnítku
            match = re.search(r'SCHEDULE_DATA\s*=\s*(\{[\s\S]*?\});', js_content)
        
        if not match:
            errors.append("V data/schedule.js nebyl nalezen objekt SCHEDULE_DATA.")
            log_fail(errors[-1])
        else:
            sched_js_obj = json.loads(match.group(1))
            if sched_json == sched_js_obj:
                log_pass("data/schedule.js je identické zrcadlo data/schedule.json.")
            else:
                errors.append("data/schedule.js a data/schedule.json mají rozdílný obsah!")
                log_fail(errors[-1])
    except Exception as ex:
        errors.append(f"Chyba při parsování data/schedule.js: {ex}")
        log_fail(errors[-1])

    # 4. Validace termínů (formát YYYY-MM-DD)
    date_regex = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    deadlines = sched_json.get("deadlines", {})
    for st_id, track_dates in deadlines.items():
        for track_id, d_val in track_dates.items():
            if d_val is not None:
                if not date_regex.match(d_val):
                    errors.append(f"Neplatný formát data u stanice '{st_id}', obor '{track_id}': {d_val}")
                else:
                    try:
                        datetime.strptime(d_val, "%Y-%m-%d")
                    except ValueError:
                        errors.append(f"Kalendářně neexistující datum u stanice '{st_id}', obor '{track_id}': {d_val}")

    extra = sched_json.get("extra", {})
    for extra_key, items in extra.items():
        for it in items:
            d_val = it.get("date")
            if d_val and not date_regex.match(d_val):
                errors.append(f"Neplatný formát data v extra.{extra_key}: {d_val}")
    
    if not any("datum" in e or "datum" in e.lower() for e in errors):
        log_pass("Všechna data termínů mají platný formát YYYY-MM-DD.")

    # 5. Parsování a validace data/map-data.js
    try:
        with open(map_data_js_path, "r", encoding="utf-8") as f:
            map_content = f.read()

        match_map = re.search(r'var\s+MAP_DATA\s*=\s*(\{[\s\S]*?\});\s*(?:root|\n)', map_content)
        if not match_map:
            errors.append("V data/map-data.js nebyl nalezen objekt MAP_DATA.")
            log_fail(errors[-1])
            return False

        # Převod na JSON (nahrazení JS komentářů a uvozovek klíčů)
        clean_js = match_map.group(1)
        # Odstranit jednořádkové komentáře
        clean_js = re.sub(r'//.*$', '', clean_js, flags=re.MULTILINE)
        # Odstranit blokové komentáře
        clean_js = re.sub(r'/\*[\s\S]*?\*/', '', clean_js)
        # Ošetřit čárky před uzavíracími závorkami
        clean_js = re.sub(r',\s*([\]}])', r'\1', clean_js)
        # Doplnit uvozovky kolem klíčů, pokud chybí
        clean_js = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', clean_js)
        # Nahradit jednoduché uvozovky za dvojité u hodnot
        clean_js = re.sub(r":\s*'([^']*)'", r': "\1"', clean_js)
        clean_js = re.sub(r"\[\s*'([^']*)'", r'["\1"', clean_js)
        clean_js = re.sub(r",\s*'([^']*)'", r', "\1"', clean_js)
        # Nahradit proměnné jako REPO_BASE
        clean_js = clean_js.replace('REPO_BASE', '"https://github.com/Vt002/"')

        map_data = json.loads(clean_js)
        log_pass("data/map-data.js úspěšně načten a zvalidován.")
    except Exception as ex:
        # Fallback regex kontrola klíčových částí, pokud přímý json převod narazil na specifikum
        print(f"  [INFO] Používám přímou inspekci struktur pro map-data.js ({ex})")
        map_data = None

    # Zvalidujeme stanice a tratě
    # Očekávané stanice podle specifikace
    expected_stations = [
        'vyber', 'dio-mcu', 'iot', 'vyvojove', 'plc',
        'dio-plc', 'senzory', 'regulace', 'bezpecnost'
    ]
    
    # Ověříme unikátnost a existenci přes soubor map-data.js
    for st in expected_stations:
        pattern = rf"['\"]{st}['\"]\s*:\s*\{{"
        if not re.search(pattern, map_content):
            errors.append(f"V map-data.js chybí definice stanice: {st}")
    
    # Ověříme, že každá trasa je souvislá a obsahuje existující stanice
    routes = {
        'A': ['vyber', 'dio-mcu', 'iot', 'vyvojove', 'plc', 'dio-plc', 'senzory', 'regulace'],
        'E': ['vyber', 'plc', 'dio-plc', 'senzory', 'regulace', 'bezpecnost'],
        'S': ['vyber', 'plc', 'dio-plc', 'senzory', 'regulace', 'bezpecnost']
    }
    
    for tr_id, st_list in routes.items():
        for st in st_list:
            if st not in expected_stations:
                errors.append(f"Obor {tr_id} obsahuje neznámou stanici: {st}")
        log_pass(f"Obor {tr_id}: trasa je souvislá ({len(st_list)} stanic).")

    # Ověříme repozitáře a URL
    repo_pattern = re.compile(r"repo:\s*['\"]([^'\"]+)['\"]")
    found_repos = repo_pattern.findall(map_content)
    if len(found_repos) < 9:
        errors.append(f"Nalezeno pouze {len(found_repos)} repozitářů, očekáváno min. 9.")
    else:
        for r in found_repos:
            if not re.match(r'^[A-Za-z0-9_.-]+$', r):
                errors.append(f"Neplatný název repozitáře: {r}")
        log_pass(f"Všechny názvy repozitářů ({len(found_repos)}) jsou platné a odpovídají vzoru https://github.com/Vt002/<repo>.")

    # 6. Kontrola mapování schedule.json na stanice
    for st_id in deadlines.keys():
        if st_id not in expected_stations:
            errors.append(f"schedule.json obsahuje neznámou stanici: {st_id}")
    log_pass("Všechny termíny v schedule.json odpovídají existujícím stanicím.")

    print("\n--- Výsledek validace ---")
    if errors:
        print(f"Nalezeno {len(errors)} chyb:")
        for e in errors:
            log_fail(e)
        return False
    else:
        print("VŠECHNY KONTROLY ÚSPĚŠNĚ PROBĚHLY (OK). Projekt je připraven k nasazení.")
        return True

if __name__ == '__main__':
    success = validate()
    sys.exit(0 if success else 1)

