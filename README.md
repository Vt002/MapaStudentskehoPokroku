# 🗺️ Mapa studentského pokroku - test

> **Interaktivní statická webová aplikace připravená jako GitHub Template repozitář.**  
> Slouží studentům k formativnímu sledování vlastního učebního pokroku v odborných maturitních okruzích (obory A, E, S) a pedagogům k transparentnímu nastavování kritérií úspěchu a termínů.

---

## 🎨 Dostupné vizuální skiny (vzhledy)
V pravém horním rohu ovládací lišty si můžete zvolit jeden ze 4 vizuálních skinů:
1. **Cyberpunk (výchozí):** Neonová sci-fi grafika s pulzujícím proudem dat a HUD prvky.
2. **Minimalistický světlý:** Čistý, kontrastní světlý design vhodný pro denní studium a tisk.
3. **Minimalistický tmavý:** Elegantní břidlicově tmavé téma bez rušivých efektů.
4. **Sci-fi RPG hra:** Futuristické herní rozhraní s prvky space-quest mapy a zlatými akcenty.

---

## ⚡ Rychlý start pro studenty (krok za krokem)

Tento repozitář je připraven jako **GitHub Template**. Nevytváříte běžný „fork“, ale čistou vlastní kopii.

### Možnost 1: Vlastní GitHub (doporučeno jako soukromý repozitář)
1. V záhlaví tohoto repozitáře klikněte na zelené tlačítko **„Use this template“** a zvolte **„Create a new repository“**.
2. Pojmenujte svůj repozitář (např. `mapa-pokroku`).
3. 🔒 **Doporučení k soukromí:** Nastavte repozitář jako **Private (soukromý)**. Tím zajistíte plnou ochranu svých poznámek a hodnocení.
4. Prohlížení a provoz:
   - Pokud máte studentský balíček *GitHub Student Developer Pack (Education/Pro)*, můžete v **Settings ➔ Pages** zapnout živé publikování na GitHub Pages i pro soukromý repozitář.
   - Na bezplatném účtu GitHub Free zveřejňuje Pages pouze z veřejných repozitářů – v takovém případě doporučujeme soukromou kopii otevírat lokálně (viz Možnost 2).

### Možnost 2: Zcela soukromý offline běh (z disku bez GitHub Pages)
1. Zvolte zelené tlačítko **Code** ➔ **Download ZIP**.
2. Rozbalte archiv na svém počítači nebo flashdisku.
3. Dvakrát klikněte na soubor `index.html`. Aplikace funguje okamžitě a plnohodnotně přímo z disku (protokol `file://`), bez nutnosti instalovat jakýkoli server či Node.js!

---

## 🔒 Soukromí a ukládání dat (Jak to funguje)

- **Výhradně lokální úložiště:** Veškerá vaše hodnocení, zaškrtnuté splněné úlohy, sebehodnocení i osobní poznámky se ukládají **pouze ve vašem internetovém prohlížeči** pod klíčem `msp:v1:<cesta>` v `localStorage`.
- **Doporučení pro studenty:** Do poznámek a hodnocení nezadávejte příliš osobní ani citlivé informace. Zaměřte se především na odborné postřehy, technické parametry zapojení a vlastní sebehodnocení k probíraným tématům.
- **Žádný automatický commit:** Aplikace sama od sebe nikdy nic nezapisuje zpět do GitHub repozitáře.
- **Export `progress.json`:** Tlačítko slouží k vytvoření lokální zálohy. Záložní soubor necommitujte do veřejných repozitářů.

---

## 🧭 Formativní architektura: Tři klíčové otázky

Aplikace striktně vychází z vědeckých principů formativního hodnocení (*Black & Wiliam, Hattie & Timperley, Sadler, PedF UK / PedF MU*). Po kliknutí na kterékoli téma se otevře panel strukturovaný podle 3 otázek:

1. **Kam směřuji? (Feed Up):**
   - Rozbalovací panely s **živým načítáním cílů a ověření cílů přímo z repozitářů GitHubu**. Jakmile vyučující v repozitáři cíl upraví, zde se automaticky zobrazí aktuální znění.
2. **Kde jsem teď? (Feed Back):**
   - **Stav:** *Ještě jsem nezačal/a* · *Pracuji na tom* · *Zvládám* · *Potřebuji pomoc*.
   - **Sebehodnocení:** *Zvládl/a jsem jistě* · *S dopomocí* · *Zůstávají nejasnosti*.
   - **Seznam úloh:** Záznam laboratorních úloh, datum splnění, známka/body a prostorné pole **Vlastní komentář** pro formativní reflexi.
   - **Ipsativní norma:** Zobrazuje se pouze váš vlastní pokrok v čase (*Hotovo X z Y úloh*). V aplikaci není žádné srovnávání se spolužáky, průměry ani žebříčky!
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
4. Zkopírujte nebo stáhněte vygenerovaný obsah do `data/schedule.json` a `data/schedule.js`.
5. Proveďte commit a push do větve `main`. Všechny studentské kopie připojené k internetu si nový `schedule.json` automaticky načtou při otevření.

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
