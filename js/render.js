/**
 * MAPA STUDENTSKÉHO POKROKU - VYHLEDOVÝ A RENDEROVACÍ MODUL
 * Generování inline SVG metro mapy, seznamu úloh, detailního panelu a formativních prvků.
 */
(function (root) {
  'use strict';

  function formatDateCZ(isoStr, includeYear) {
    if (!isoStr) return '';
    var parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    var day = parseInt(parts[2], 10);
    var month = parseInt(parts[1], 10);
    var year = parts[0];
    if (includeYear) {
      return day + '. ' + month + '. ' + year;
    }
    return day + '. ' + month + '.';
  }

  function getDaysDiff(isoDateStr, todayIso) {
    var d = new Date(isoDateStr + 'T00:00:00');
    var t = new Date(todayIso + 'T00:00:00');
    var diffMs = d.getTime() - t.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function evaluateDeadline(deadlineIso, isDone, completedAtIso, todayIso) {
    if (isDone) {
      return {
        state: 'done',
        icon: '✓',
        text: 'Splněno' + (completedAtIso ? ' (' + formatDateCZ(completedAtIso, true) + ')' : ''),
        shortText: 'Splněno'
      };
    }
    if (!deadlineIso) {
      return {
        state: 'none',
        icon: '–',
        text: 'Termín neurčen',
        shortText: 'Bez termínu'
      };
    }
    var diff = getDaysDiff(deadlineIso, todayIso);
    if (diff < 0) {
      return {
        state: 'overdue',
        icon: '💬',
        text: 'Termín uplynul (' + formatDateCZ(deadlineIso, true) + ') – domluv další postup s vyučujícím',
        shortText: 'Uplynul (' + formatDateCZ(deadlineIso) + ')'
      };
    } else if (diff <= 14) {
      return {
        state: 'near',
        icon: '⏳',
        text: 'Blíží se termín: do ' + formatDateCZ(deadlineIso, true) + ' (zbývá ' + diff + ' dní)',
        shortText: 'Do ' + formatDateCZ(deadlineIso)
      };
    } else {
      return {
        state: 'future',
        icon: '📅',
        text: 'Do ' + formatDateCZ(deadlineIso, true) + ' (za více než 14 dní)',
        shortText: 'Do ' + formatDateCZ(deadlineIso)
      };
    }
  }

  // Souřadnice metro mapy
  var MAP_COORDS = {
    viewBox: '0 0 1360 440',
    stations: {
      'vyber':     { x: 90,   y: 260, h: 100, isBranch: false, titleY: 345 },
      'dio-mcu':   { x: 250,  y: 110, h: 44,  isBranch: true,  titleY: 65 },
      'iot':       { x: 410,  y: 110, h: 44,  isBranch: true,  titleY: 65 },
      'vyvojove':  { x: 570,  y: 110, h: 44,  isBranch: true,  titleY: 65 },
      'plc':       { x: 730,  y: 260, h: 100, isBranch: false, titleY: 345 },
      'dio-plc':   { x: 890,  y: 260, h: 100, isBranch: false, titleY: 345 },
      'senzory':   { x: 1040, y: 260, h: 100, isBranch: false, titleY: 345 },
      'regulace':  { x: 1180, y: 260, h: 100, isBranch: false, titleY: 345 },
      'bezpecnost':{ x: 1290, y: 275, h: 70,  isBranch: false, titleY: 345 }
    },
    trackY: {
      A_branch: 110,
      A_main: 230,
      E_main: 260,
      S_main: 290
    }
  };

  var MSPRender = {
    formatDateCZ: formatDateCZ,
    evaluateDeadline: evaluateDeadline,

    /**
     * Vykreslení SVG metro mapy
     */
    renderSVGMap: function (container, mapData, scheduleData, studentState, onStationSelect) {
      var selectedTrack = studentState.selectedTrack || 'ALL';
      var today = root.MSPStorage.getISODateToday();
      var currentStationId = this.detectCurrentStationId(mapData, studentState);

      var filterClass = '';
      if (selectedTrack === 'A') filterClass = 'filter-a';
      else if (selectedTrack === 'E') filterClass = 'filter-e';
      else if (selectedTrack === 'S') filterClass = 'filter-s';

      var svgHtml = [];
      svgHtml.push('<svg class="metro-svg ' + filterClass + '" viewBox="' + MAP_COORDS.viewBox + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interaktivní metro mapa studentského pokroku">');
      
      // Filtry a definice záře
      svgHtml.push('<defs>');
      svgHtml.push('  <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
      svgHtml.push('  <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
      svgHtml.push('  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#00E5FF"/></marker>');
      svgHtml.push('</defs>');

      // Tratě (Linky)
      // 1. Trať A: Vyber (230) -> odbočka nahoru na Y=110 -> dio-mcu, iot, vyvojove -> dolů na PLC (230) -> dio-plc -> senzory -> regulace (konečná)
      var pathA = 'M 90,230 C 150,230 180,110 250,110 L 570,110 C 640,110 670,230 730,230 L 1180,230';
      svgHtml.push('<path class="track-line track-a" d="' + pathA + '" />');
      svgHtml.push('<path class="track-pulse track-a" d="' + pathA + '" />');

      // 2. Trať E: Vyber (260) -> rovně přes PLC, DIO-PLC, Senzory, Regulace -> Bezpečnost (260)
      var pathE = 'M 90,260 L 1290,260';
      svgHtml.push('<path class="track-line track-e" d="' + pathE + '" />');
      svgHtml.push('<path class="track-pulse track-e" d="' + pathE + '" />');

      // 3. Trať S: Vyber (290) -> rovně přes PLC, DIO-PLC, Senzory, Regulace -> Bezpečnost (290)
      var pathS = 'M 90,290 L 1290,290';
      svgHtml.push('<path class="track-line track-s" d="' + pathS + '" />');
      svgHtml.push('<path class="track-pulse track-s" d="' + pathS + '" />');

      // Vykreslení uzlů stanic
      for (var stId in MAP_COORDS.stations) {
        if (!Object.prototype.hasOwnProperty.call(MAP_COORDS.stations, stId)) continue;
        var coord = MAP_COORDS.stations[stId];
        var stDef = mapData.stations[stId];
        if (!stDef) continue;

        var stRecord = studentState.stations[stId] || { status: 'not_started' };
        var isDone = stRecord.status === 'done';
        var isWorking = stRecord.status === 'working';
        var isHelp = stRecord.status === 'help';

        // Termín pro zvolený obor
        var dlIso = null;
        if (scheduleData && scheduleData.deadlines && scheduleData.deadlines[stId]) {
          var dlObj = scheduleData.deadlines[stId];
          if (selectedTrack !== 'ALL') {
            dlIso = dlObj[selectedTrack];
          } else {
            dlIso = dlObj.A || dlObj.E || dlObj.S;
          }
        }
        var dlInfo = evaluateDeadline(dlIso, isDone, stRecord.completedAt, today);

        // Třídy stavu
        var statusClass = 'status-waiting';
        if (isDone) statusClass = 'status-done';
        else if (isWorking) statusClass = 'status-working';
        else if (isHelp) statusClass = 'status-help';

        var isCurrent = (currentStationId === stId);

        svgHtml.push('<g class="station-node" data-id="' + stId + '" tabindex="0" role="button" aria-label="Téma: ' + stDef.title + ', stav: ' + stRecord.status + ', termín: ' + dlInfo.shortText + '">');
        
        // Tvar kapsle
        var capW = 38;
        var capX = coord.x - capW / 2;
        var capY = coord.y - coord.h / 2;
        svgHtml.push('  <rect class="station-shape ' + statusClass + '" x="' + capX + '" y="' + capY + '" width="' + capW + '" height="' + coord.h + '" rx="14" />');

        // Stavová ikona uprostřed
        var iconChar = '•';
        if (isDone) iconChar = '✓';
        else if (isWorking) iconChar = '⚡';
        else if (isHelp) iconChar = '?';
        svgHtml.push('  <text x="' + coord.x + '" y="' + (coord.y + 5) + '" text-anchor="middle" fill="#E6F1FF" font-family="JetBrains Mono" font-size="14" font-weight="700">' + iconChar + '</text>');

        // Pin "Jsem tady"
        if (isCurrent) {
          var pinY = capY - 26;
          svgHtml.push('  <g class="pin-here" transform="translate(' + coord.x + ',' + pinY + ')">');
          svgHtml.push('    <path d="M 0,0 L 8,-14 A 8,8 0 1,0 -8,-14 Z" fill="#00E5FF" filter="url(#glowCyan)"/>');
          svgHtml.push('    <circle cx="0" cy="-14" r="3.5" fill="#05060F"/>');
          svgHtml.push('    <text x="0" y="-24" text-anchor="middle" fill="#00E5FF" font-family="JetBrains Mono" font-size="10" font-weight="700" letter-spacing="1">JSEM TADY</text>');
          svgHtml.push('  </g>');
        }

        // Název stanice
        var displayTitle = stDef.title;
        if (displayTitle.length > 24) {
          displayTitle = displayTitle.slice(0, 22) + '…';
        }
        svgHtml.push('  <text class="station-title-text" x="' + coord.x + '" y="' + coord.titleY + '">' + displayTitle + '</text>');

        // Termín pod názvem
        var dlColor = '#9BB0D3';
        if (dlInfo.state === 'overdue') dlColor = '#FFA07A';
        else if (dlInfo.state === 'near') dlColor = '#FFB000';
        else if (dlInfo.state === 'done') dlColor = '#39FF88';
        svgHtml.push('  <text class="station-deadline-text" x="' + coord.x + '" y="' + (coord.titleY + 16) + '" fill="' + dlColor + '">' + dlInfo.shortText + '</text>');

        // Malý odkaz na repo ↗
        var repoUrl = mapData.repoBaseUrl + stDef.repo;
        svgHtml.push('  <a href="' + repoUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Otevřít repozitář ' + stDef.title + ' v nové záložce">');
        svgHtml.push('    <text x="' + (coord.x + 22) + '" y="' + (coord.titleY - 8) + '" fill="#00E5FF" font-family="JetBrains Mono" font-size="12" font-weight="700">↗</text>');
        svgHtml.push('  </a>');

        svgHtml.push('</g>');
      }

      svgHtml.push('</svg>');

      container.innerHTML = svgHtml.join('\n');

      // Navázání událostí na uzly stanic
      var nodes = container.querySelectorAll('.station-node');
      nodes.forEach(function (node) {
        var id = node.getAttribute('data-id');
        node.addEventListener('click', function (e) {
          if (e.target.tagName.toLowerCase() === 'a' || e.target.parentElement.tagName.toLowerCase() === 'a') {
            return; // Klik na ↗ odkaz neotevírá drawer
          }
          onStationSelect(id);
        });
        node.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStationSelect(id);
          }
        });
      });
    },

    /**
     * Vykreslení seznamového pohledu (akordeon pro mobil/tisk)
     */
    renderListView: function (container, mapData, scheduleData, studentState, onStationSelect) {
      var selectedTrack = studentState.selectedTrack || 'ALL';
      var today = root.MSPStorage.getISODateToday();
      var currentStationId = this.detectCurrentStationId(mapData, studentState);

      // Určíme pořadí stanic podle zvoleného oboru
      var stationIds = [];
      if (selectedTrack !== 'ALL' && mapData.tracks[selectedTrack]) {
        stationIds = mapData.tracks[selectedTrack].stations;
      } else {
        // Všechny stanice v logickém pořadí A
        stationIds = ['vyber', 'dio-mcu', 'iot', 'vyvojove', 'plc', 'dio-plc', 'senzory', 'regulace', 'bezpecnost'];
      }

      var html = ['<ol class="stations-list-view">'];

      stationIds.forEach(function (stId, idx) {
        var stDef = mapData.stations[stId];
        if (!stDef) return;

        var stRecord = studentState.stations[stId] || { status: 'not_started' };
        var isDone = stRecord.status === 'done';
        var dlIso = null;
        if (scheduleData && scheduleData.deadlines && scheduleData.deadlines[stId]) {
          var dlObj = scheduleData.deadlines[stId];
          dlIso = (selectedTrack !== 'ALL') ? dlObj[selectedTrack] : (dlObj.A || dlObj.E || dlObj.S);
        }
        var dlInfo = evaluateDeadline(dlIso, isDone, stRecord.completedAt, today);
        var isCurrent = (currentStationId === stId);

        html.push('<li class="list-station-card">');
        html.push('  <div class="list-station-header" data-id="' + stId + '" role="button" tabindex="0" aria-expanded="false">');
        
        // Levá strana
        html.push('    <div class="list-station-left">');
        html.push('      <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim);">' + (idx + 1) + '.</span>');
        
        // Štítky oborů
        html.push('      <div class="station-badge-group">');
        for (var trk in stDef.trackNumbers) {
          var num = stDef.trackNumbers[trk] || trk;
          html.push('        <span class="track-badge badge-' + trk.toLowerCase() + '" title="Číslo v trase: ' + num + '">' + num + '</span>');
        }
        html.push('      </div>');

        html.push('      <span class="list-station-title">' + stDef.title + '</span>');
        if (isCurrent) {
          html.push('      <span style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--track-a); color: #05060F; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 2px;">JSEM TADY</span>');
        }
        html.push('    </div>');

        // Pravá strana
        html.push('    <div class="list-station-right">');
        html.push('      <span class="deadline-pill state-' + dlInfo.state + '">' + dlInfo.icon + ' ' + dlInfo.shortText + '</span>');
        html.push('      <a class="repo-link-icon" href="' + mapData.repoBaseUrl + stDef.repo + '" target="_blank" rel="noopener noreferrer" aria-label="Otevřít repozitář ' + stDef.title + ' v nové záložce">↗</a>');
        html.push('    </div>');

        html.push('  </div>');
        html.push('</li>');
      });

      html.push('</ol>');
      container.innerHTML = html.join('\n');

      var headers = container.querySelectorAll('.list-station-header');
      headers.forEach(function (header) {
        var id = header.getAttribute('data-id');
        header.addEventListener('click', function (e) {
          if (e.target.tagName.toLowerCase() === 'a') return;
          onStationSelect(id);
        });
        header.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStationSelect(id);
          }
        });
      });
    },

    /**
     * Vykreslení detailního vysunovacího panelu (Drawer)
     */
    renderDetailsPanel: function (panelElement, stationId, mapData, scheduleData, studentState, callbacks) {
      var isExtra = (stationId === 'rocnikovy');
      var stDef = isExtra ? mapData.extra.rocnikovy : mapData.stations[stationId];
      if (!stDef) return;

      var stRecord = isExtra 
        ? (studentState.extra && studentState.extra.rocnikovy) 
        : (studentState.stations[stationId] || { status: 'not_started', tasks: {} });
      if (!stRecord) stRecord = { status: 'not_started', tasks: {} };

      var selectedTrack = studentState.selectedTrack || 'ALL';
      var today = root.MSPStorage.getISODateToday();
      var dlIso = null;
      if (!isExtra && scheduleData && scheduleData.deadlines && scheduleData.deadlines[stationId]) {
        var dlObj = scheduleData.deadlines[stationId];
        dlIso = (selectedTrack !== 'ALL') ? dlObj[selectedTrack] : (dlObj.A || dlObj.E || dlObj.S);
      }
      var dlInfo = evaluateDeadline(dlIso, stRecord.status === 'done', stRecord.completedAt, today);

      var repoUrl = mapData.repoBaseUrl + stDef.repo;

      var html = [];
      
      // Hlavička draweru
      html.push('<div class="details-header">');
      html.push('  <div class="details-header-top">');
      html.push('    <div class="details-title-wrap">');
      html.push('      <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--track-a); letter-spacing: 1.5px;">DETAIL TÉMATU // SPECIFIKACE</div>');
      html.push('      <h2 class="details-title">' + stDef.title + '</h2>');
      html.push('    </div>');
      html.push('    <button class="btn-close-drawer" id="btn-close-drawer" aria-label="Zavřít panel (Esc)">✕</button>');
      html.push('  </div>');

      // Štítky oborů a canvas kódy
      html.push('  <div class="details-tags-row">');
      if (stDef.trackNumbers) {
        for (var t in stDef.trackNumbers) {
          var tn = stDef.trackNumbers[t] || t;
          html.push('    <span class="track-badge badge-' + t.toLowerCase() + '">Obor ' + t + ': ' + tn + '</span>');
        }
      }
      if (stDef.tags && stDef.tags.length > 0) {
        stDef.tags.forEach(function (tag) {
          html.push('    <span class="canvas-tag" title="Význam doplní vyučující">' + tag + '</span>');
        });
      }
      html.push('    <span class="deadline-pill state-' + dlInfo.state + '">' + dlInfo.icon + ' ' + dlInfo.text + '</span>');
      html.push('    <a class="cyber-anchor-btn" href="' + repoUrl + '" target="_blank" rel="noopener noreferrer">Otevřít repozitář ↗</a>');
      html.push('  </div>');
      html.push('</div>'); // /details-header

      // Tělo draweru (Tři otázky formativního hodnocení)
      html.push('<div class="details-content">');

      // 1. KAM SMĚŘUJI? (Feed Up)
      html.push('  <section class="formative-card q1">');
      html.push('    <h3 class="card-question-title"><span>1.</span> Kam směřuji? (Cíle a kritéria)</h3>');
      html.push('    <p style="font-size: 0.95rem; color: var(--text-muted);">Prostuduj si cíl výuky a kritéria zvládnutí definovaná v README repozitáře:</p>');
      html.push('    <div class="q1-links">');
      html.push('      <a class="cyber-anchor-btn" href="' + repoUrl + '#cíl" target="_blank" rel="noopener noreferrer">🎯 Cíl tématu v README</a>');
      html.push('      <a class="cyber-anchor-btn" href="' + repoUrl + '#ověření-cílů" target="_blank" rel="noopener noreferrer">🔍 Ověření cílů v README</a>');
      html.push('    </div>');
      html.push('  </section>');

      // 2. KDE JSEM TEĎ? (Feed Back)
      html.push('  <section class="formative-card q2">');
      html.push('    <h3 class="card-question-title"><span>2.</span> Kde jsem teď? (Stav a sebehodnocení)</h3>');
      
      // Výběr stavu
      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem;">');
      html.push('      <span class="control-label">Můj aktuální stav v tématu:</span>');
      html.push('      <div class="status-pill-grid">');
      var statuses = [
        { id: 'not_started', label: 'Ještě jsem nezačal/a' },
        { id: 'working',     label: 'Pracuji na tom' },
        { id: 'done',        label: 'Zvládám' },
        { id: 'help',        label: 'Potřebuji pomoc' }
      ];
      statuses.forEach(function (s) {
        var isSel = (stRecord.status === s.id);
        html.push('        <label class="radio-pill-label ' + (isSel ? 'selected' : '') + '">');
        html.push('          <input type="radio" name="station-status" value="' + s.id + '" ' + (isSel ? 'checked' : '') + ' />');
        html.push('          <span>' + s.label + '</span>');
        html.push('        </label>');
      });
      html.push('      </div>');
      html.push('    </div>');

      // Sebehodnocení vůči kritériím
      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">');
      html.push('      <span class="control-label">Sebehodnocení zvládnutí učiva:</span>');
      html.push('      <div class="status-pill-grid">');
      var assessments = [
        { id: 'certain',   label: 'Zvládl/a jsem jistě' },
        { id: 'with_help', label: 'S dopomocí' },
        { id: 'unclear',   label: 'Zůstávají nejasnosti' }
      ];
      assessments.forEach(function (a) {
        var isSel = (stRecord.selfAssessment === a.id);
        html.push('        <label class="radio-pill-label ' + (isSel ? 'selected' : '') + '">');
        html.push('          <input type="radio" name="station-self-assessment" value="' + a.id + '" ' + (isSel ? 'checked' : '') + ' />');
        html.push('          <span>' + a.label + '</span>');
        html.push('        </label>');
      });
      html.push('      </div>');
      html.push('    </div>');

      // Tabulka úloh
      html.push('    <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">');
      html.push('      <div class="task-summary-banner">');
      html.push('        <span id="task-completion-stat">Načítám úlohy…</span>');
      html.push('        <button class="btn-add-task" id="btn-add-custom-task" type="button">+ Přidat vlastní úlohu</button>');
      html.push('      </div>');

      html.push('      <div class="tasks-table-wrap">');
      html.push('        <table class="cyber-table">');
      html.push('          <thead>');
      html.push('            <tr>');
      html.push('              <th style="width: 40px;">Hotovo</th>');
      html.push('              <th>Název úlohy</th>');
      html.push('              <th style="width: 110px;">Datum</th>');
      html.push('              <th style="width: 140px;">Úroveň</th>');
      html.push('              <th style="width: 110px;">Známka/body</th>');
      html.push('              <th>Komentář</th>');
      html.push('              <th style="width: 40px;"></th>');
      html.push('            </tr>');
      html.push('          </thead>');
      html.push('          <tbody id="tasks-table-body">');
      html.push('          </tbody>');
      html.push('        </table>');
      html.push('      </div>');
      html.push('    </div>');

      html.push('  </section>'); // /q2

      // 3. JAK DÁL? (Feed Forward)
      html.push('  <section class="formative-card q3">');
      html.push('    <h3 class="card-question-title"><span>3.</span> Jak dál? (Akční plán a reflexe)</h3>');
      
      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem;">');
      html.push('      <label class="control-label" for="txt-next-step">Můj nejbližší další krok k překonání překážek:</label>');
      html.push('      <textarea class="cyber-textarea" id="txt-next-step" placeholder="Např. projít znovu zapojení pull-up rezistoru, konzultovat s vyučujícím měření multimetrem..."></textarea>');
      html.push('    </div>');

      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">');
      html.push('      <label class="control-label" for="txt-notes">Moje osobní poznámky a postřehy z laboratorní práce:</label>');
      html.push('      <textarea class="cyber-textarea" id="txt-notes" placeholder="Poznámky, čísla pinů, zjištěné hodnoty součástek..."></textarea>');
      html.push('    </div>');

      html.push('  </section>'); // /q3

      html.push('</div>'); // /details-content

      panelElement.innerHTML = html.join('\n');

      // Vykreslení a obsluha tabulky úloh
      this.populateTasksTable(panelElement, stationId, stDef, stRecord, callbacks);

      // Naplnění polí a event listenery
      var txtNext = panelElement.querySelector('#txt-next-step');
      var txtNotes = panelElement.querySelector('#txt-notes');
      txtNext.value = stRecord.nextStep || '';
      txtNotes.value = stRecord.notes || '';

      txtNext.addEventListener('change', function () {
        callbacks.onFieldChange(stationId, 'nextStep', txtNext.value);
      });
      txtNotes.addEventListener('change', function () {
        callbacks.onFieldChange(stationId, 'notes', txtNotes.value);
      });

      // Změna stavu (status)
      var statusRadios = panelElement.querySelectorAll('input[name="station-status"]');
      statusRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          callbacks.onFieldChange(stationId, 'status', radio.value);
        });
      });

      // Změna sebehodnocení
      var selfRadios = panelElement.querySelectorAll('input[name="station-self-assessment"]');
      selfRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          callbacks.onFieldChange(stationId, 'selfAssessment', radio.value);
        });
      });

      // Tlačítko zavřít
      panelElement.querySelector('#btn-close-drawer').addEventListener('click', callbacks.onClose);

      // Tlačítko přidat úlohu
      panelElement.querySelector('#btn-add-custom-task').addEventListener('click', function () {
        var title = prompt('Zadejte název nové vlastní úlohy / měření:');
        if (title && title.trim()) {
          callbacks.onAddCustomTask(stationId, title.trim());
        }
      });
    },

    /**
     * Vykreslení řádků tabulky úloh
     */
    populateTasksTable: function (panelElement, stationId, stDef, stRecord, callbacks) {
      var tbody = panelElement.querySelector('#tasks-table-body');
      var statSpan = panelElement.querySelector('#task-completion-stat');
      if (!tbody) return;

      tbody.innerHTML = '';

      // Sloučíme definované úlohy s případnými custom úlohami uloženými studentem
      var allTasks = [];
      var staticTasks = stDef.tasks || [];
      staticTasks.forEach(function (t) {
        allTasks.push({
          id: t.id,
          title: t.title,
          challenge: !!t.challenge,
          isCustom: false
        });
      });

      // Přidáme custom úlohy z localStorage
      if (stRecord.tasks) {
        for (var tId in stRecord.tasks) {
          if (!Object.prototype.hasOwnProperty.call(stRecord.tasks, tId)) continue;
          var tObj = stRecord.tasks[tId];
          if (tObj && tObj.isCustom) {
            allTasks.push({
              id: tId,
              title: tObj.title || 'Vlastní úloha',
              challenge: false,
              isCustom: true
            });
          }
        }
      }

      var completedCount = 0;
      var totalCount = allTasks.length;

      allTasks.forEach(function (task) {
        var tData = (stRecord.tasks && stRecord.tasks[task.id]) || {
          done: false,
          date: '',
          level: 0,
          grade: '',
          comment: ''
        };

        if (tData.done) completedCount++;

        var tr = document.createElement('tr');

        // 1. Hotovo
        var tdDone = document.createElement('td');
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'cyber-checkbox';
        chk.checked = !!tData.done;
        chk.title = 'Označit úlohu jako splněnou';
        chk.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, {
            done: chk.checked,
            date: chk.checked && !tData.date ? root.MSPStorage.getISODateToday() : tData.date
          });
        });
        tdDone.appendChild(chk);
        tr.appendChild(tdDone);

        // 2. Název
        var tdTitle = document.createElement('td');
        tdTitle.className = 'task-title-cell';
        tdTitle.textContent = task.title;
        if (task.challenge) {
          var chalSpan = document.createElement('span');
          chalSpan.className = 'challenge-tag';
          chalSpan.textContent = 'výzva';
          tdTitle.appendChild(chalSpan);
        }
        tr.appendChild(tdTitle);

        // 3. Datum
        var tdDate = document.createElement('td');
        var inDate = document.createElement('input');
        inDate.type = 'date';
        inDate.className = 'cyber-input';
        inDate.value = tData.date || '';
        inDate.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { date: inDate.value });
        });
        tdDate.appendChild(inDate);
        tr.appendChild(tdDate);

        // 4. Úroveň (Rubrika)
        var tdLevel = document.createElement('td');
        var selLevel = document.createElement('select');
        selLevel.className = 'cyber-select';
        var opts = [
          { val: 0, label: '– Neurčeno' },
          { val: 1, label: '1 Začátečník' },
          { val: 2, label: '2 Pokročilý' },
          { val: 3, label: '3 Expert' }
        ];
        opts.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o.val;
          opt.textContent = o.label;
          if (parseInt(tData.level, 10) === o.val) opt.selected = true;
          selLevel.appendChild(opt);
        });
        selLevel.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { level: parseInt(selLevel.value, 10) });
        });
        tdLevel.appendChild(selLevel);
        tr.appendChild(tdLevel);

        // 5. Známka/body (volný text max 12 znaků)
        var tdGrade = document.createElement('td');
        var inGrade = document.createElement('input');
        inGrade.type = 'text';
        inGrade.className = 'cyber-input';
        inGrade.maxLength = 12;
        inGrade.placeholder = 'např. 1, 28/30 b';
        inGrade.value = tData.grade || '';
        inGrade.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { grade: inGrade.value.trim() });
        });
        tdGrade.appendChild(inGrade);
        tr.appendChild(tdGrade);

        // 6. Komentář
        var tdComment = document.createElement('td');
        var inComment = document.createElement('input');
        inComment.type = 'text';
        inComment.className = 'cyber-input';
        inComment.placeholder = 'Slovní zpětná vazba...';
        inComment.value = tData.comment || '';
        inComment.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { comment: inComment.value.trim() });
        });
        tdComment.appendChild(inComment);
        tr.appendChild(tdComment);

        // 7. Akce (smazání vlastní úlohy)
        var tdAction = document.createElement('td');
        if (task.isCustom) {
          var btnDel = document.createElement('button');
          btnDel.type = 'button';
          btnDel.textContent = '🗑';
          btnDel.title = 'Smazat tuto vlastní úlohu';
          btnDel.style.color = '#FF3366';
          btnDel.addEventListener('click', function () {
            if (confirm('Opravdu chcete smazat vlastní úlohu "' + task.title + '"?')) {
              callbacks.onRemoveCustomTask(stationId, task.id);
            }
          });
          tdAction.appendChild(btnDel);
        }
        tr.appendChild(tdAction);

        tbody.appendChild(tr);
      });

      if (statSpan) {
        statSpan.textContent = 'Splněno ' + completedCount + ' z ' + totalCount + ' úloh';
      }
    },

    /**
     * Zjištění ID stanice, kde se student aktuálně nachází (Pin "Jsem tady")
     */
    detectCurrentStationId: function (mapData, studentState) {
      if (studentState.manualCurrentStationId) {
        return studentState.manualCurrentStationId;
      }
      var trackId = studentState.selectedTrack;
      var trackStations = [];
      if (trackId && trackId !== 'ALL' && mapData.tracks[trackId]) {
        trackStations = mapData.tracks[trackId].stations;
      } else {
        trackStations = ['vyber', 'dio-mcu', 'iot', 'vyvojove', 'plc', 'dio-plc', 'senzory', 'regulace'];
      }

      for (var i = 0; i < trackStations.length; i++) {
        var sId = trackStations[i];
        var sRec = studentState.stations[sId];
        if (!sRec || sRec.status !== 'done') {
          return sId; // První nehotová stanice
        }
      }
      return trackStations[trackStations.length - 1]; // Vše hotovo -> poslední
    }
  };

  root.MSPRender = MSPRender;
})(typeof window !== 'undefined' ? window : global);

