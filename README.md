# 🗺️ Mapa studentského pokroku (SPŠELIT Dobruška)

> **Interaktivní statická webová aplikace ve stylu Cyberpunk HUD připravená jako GitHub Template repozitář.**  
> Slouží studentům k formativnímu sledování vlastního učebního pokroku v odborných maturitních okruzích (obory A, E, S) a pedagogům k transparentnímu nastavování kritérií úspěchu a termínů.

---

## ⚡ Rychlý start pro studenty (krok za krokem)

Tento repozitář je připraven jako **GitHub Template**. To znamená, že si nevytváříte běžný „fork“, ale čistou vlastní kopii, která není propojena s cizími commity.

### Možnost 1: Vlastní GitHub Pages (doporučeno pro online přístup)
1. V záhlaví tohoto repozitáře klikněte na zelené tlačítko **„Use this template“** a zvolte **„Create a new repository“**.
2. Pojmenujte svůj repozitář (např. `mapa-pokroku`).
3. ⚠️ **Důležité rozhodnutí o soukromí (Public vs. Private):**
   - Na bezplatných účtech GitHub Free funguje služba **GitHub Pages pouze z VEŘEJNÝCH (Public) repozitářů**.
   - Pokud máte studentský balíček *GitHub Student Developer Pack* (GitHub Pro/Education), můžete Pages zapnout i na **SOUKROMÉM (Private)** repozitáři.
4. Po vytvoření repozitáře přejděte do **Settings** ➔ v levém menu zvolte **Pages**.
5. V sekci *Build and deployment* nastavte:
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` a složka `/ (root)`
   - Klikněte na **Save**.
6. Do 1–2 minut získáte svou osobní živou URL adresu (např. `https://vase-jmeno.github.io/mapa-pokroku/`).

### Možnost 2: Zcela soukromý offline běh (z disku bez GitHub Pages)
Pokud chcete mít 100% jistotu soukromí a nemáte účet GitHub Pro:
1. Zvolte zelené tlačítko **Code** ➔ **Download ZIP**.
2. Rozbalte archiv na svém počítači nebo školním flash disku.
3. Dvakrát klikněte na soubor `index.html`. Aplikace funguje okamžitě a plnohodnotně přímo z disku (protokol `file://`), bez nutnosti instalovat jakýkoli server či Node.js!

---

## 🔒 Soukromí a ukládání dat (Jak to funguje)

- **Výhradně lokální úložiště:** Veškerá vaše hodnocení, zaškrtnuté splněné úlohy, sebehodnocení i osobní poznámky se ukládají **pouze ve vašem internetovém prohlížeči** pod klíčem `msp:v1:<cesta>` v `localStorage`.
- **Žádný automatický commit:** Aplikace sama od sebe nikdy nic nezapisuje zpět do GitHub repozitáře ani neodesílá žádnou telemetrii na cizí servery.
- ⚠️ **VAROVÁNÍ K EXPORTU `progress.json`:**
  - Tlačítko **Export progress.json** slouží k vytvoření záložního souboru na vašem disku (abyste o data nepřišli při promazání mezipaměti prohlížeče).
  - **Nikdy tento soubor necommitujte do veřejného GitHub repozitáře!** Pokud byste soubor `progress.json` nahráli do veřejného repozitáře, stalo by se vaše hodnocení a poznámky veřejně čitelné komukoli na internetu.

---

## 🧭 Formativní architektura: Tři klíčové otázky

Aplikace striktně vychází z vědeckých principů formativního hodnocení (*Black & Wiliam, Hattie & Timperley, Sadler, PedF UK / PedF MU*). Po kliknutí na kterékoli téma se otevře panel strukturovaný podle 3 otázek:

1. **Kam směřuji? (Feed Up):**
   - Přímé odkazy na `#cíl` a `#ověření-cílů` v README příslušného technického repozitáře.
   - Cíle jsou formulovány pomocí aktivních sloves Bloomovy taxonomie.
2. **Kde jsem teď? (Feed Back):**
   - **Stav:** *Ještě jsem nezačal/a* · *Pracuji na tom* · *Zvládám* · *Potřebuji pomoc*.
   - **Sebehodnocení:** *Zvládl/a jsem jistě* · *S dopomocí* · *Zůstávají nejasnosti*.
   - **Tabulka úloh:** Záznam jednotlivých laboratorních cvičení, úroveň rubriky (1 Začátečník, 2 Pokročilý, 3 Expert), volitelné pole známka/body a popisný komentář. Možnost přidávat vlastní řádky úloh tlačítkem `+ Přidat vlastní úlohu`.
   - **Ipsativní norma:** Zobrazuje se pouze váš vlastní pokrok v čase (*Hotovo X z Y úloh*). V aplikaci není žádné porovnávání se spolužáky, žádné průměry ani žebříčky!
3. **Jak dál? (Feed Forward):**
   - Konkrétní pole pro definování nejbližšího praktického kroku k překonání překážek a prostor pro technické poznámky.

---

## 🛠️ Příručka pro vyučujícího (Správa a roční aktualizace)

### 1. Jak nastavit repozitář jako Template
1. V nastavení repozitáře na GitHubu (**Settings** ➔ záložka **General**).
2. Zaškrtněte volbu **Template repository**.
3. Studenti nyní uvidí tlačítko *„Use this template“*.

### 2. Roční aktualizace termínů (Editor vyučujícího)
V patičce aplikace klikněte na odkaz **⚙️ Editor vyučujícího** (nebo otevřete `teacher/schedule-editor.html`):
1. Zadejte nový školní rok (např. `2027/2028`).
2. Vyplňte nebo posuňte termíny pro jednotlivé obory (A, E, S).
3. Klikněte na **Vygenerovat kód**.
4. Zkopírujte nebo stáhněte vygenerovaný obsah:
   - Uložte do `data/schedule.json`.
   - Uložte do `data/schedule.js` (lokální zrcadlo zajišťující funkčnost i z `file://`).
5. Proveďte commit a push do větve `main`. Všechny studentské kopie připojené k internetu si nový `schedule.json` automaticky stáhnou při dalším otevření aplikace.

### 3. Jak přidat nové téma do mapy
1. Otevřete `data/map-data.js`.
2. Do sekce `stations` přidejte nový objekt se stabilním `id`, názvem, repozitářem a výchozím seznamem úloh.
3. Přidejte `id` stanice do příslušných polí v `tracks.A.stations`, `tracks.E.stations` nebo `tracks.S.stations`.
4. Spusťte validační skript:
   ```bash
   python tools/validate.py
   ```
   Skript zkontroluje unikátnost ID, souvislost tratí i validitu odkazů.

---

## 📁 Struktura projektu

```text
mapa_pokroku/
├── index.html                   # Hlavní aplikační stránka (přístupná, sémantická)
├── README.md                    # Tato příručka pro studenty i pedagogy
├── css/
│   └── style.css                # Cyberpunk design systém, HUD prvky, tiskové styly, klidný režim
├── js/
│   ├── app.js                   # Inicializace, přepínače oborů, synchronizace termínů
│   ├── render.js                # Vykreslování SVG metro mapy, seznamu, tabulek a draweru
│   └── storage.js               # Správa localStorage (msp:v1:), export/import progress.json
├── data/
│   ├── map-data.js              # Statická data témat, úloh, repozitářů a tratí
│   ├── schedule.json            # Centrální termíny odevzdání (zdroj pravdy pro vyučujícího)
│   ├── schedule.js              # Zrcadlo schedule.json pro běh z file:// bez CORS chyb
│   ├── config.js                # URL pro stahování schedule.json vyučujícího
│   └── progress.example.json    # Ukázkový exportní soubor jednoho studenta
├── fonts/
│   ├── rajdhani-*.woff2         # Lokální webfonty Rajdhani (latin + latin-ext pro české znaky)
│   ├── jetbrains-mono-*.woff2   # Lokální webfonty JetBrains Mono (latin + latin-ext)
│   ├── OFL-Rajdhani.txt         # Licence SIL Open Font License pro Rajdhani
│   └── OFL-JetBrainsMono.txt    # Licence SIL Open Font License pro JetBrains Mono
├── teacher/
│   └── schedule-editor.html     # Vizuální editor termínů pro vyučující (posun dní, export)
└── tools/
    └── validate.py              # Automatický validační test (Python standard library)
```

---

## 🧪 Validace a testování

Projekt obsahuje vestavěný validační nástroj nevyžadující žádné instalace:
```bash
python tools/validate.py
```
**Test ověřuje:**
- Syntaktickou platnost a identitu `data/schedule.json` a `data/schedule.js`.
- Správnost formátů dat `YYYY-MM-DD`.
- Unikátnost ID všech stanic a souvislost tras oborů A, E a S.
- Soulad názvů repozitářů se vzorem `https://github.com/Vt002/<repo>`.

