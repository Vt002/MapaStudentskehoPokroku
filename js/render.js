/**
 * MAPA STUDENTSKÉHO POKROKU - VYHLEDOVÝ A RENDEROVACÍ MODUL
 * Generování inline SVG metro mapy, seznamu úloh, detailního panelu a formativních prvků.
 */
(function (root) {
  'use strict';

  var repoContentCache = {};

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

  /**
   * Jednoduchý bezpečný Markdown parser pro obsah sekcí README
   */
  function parseMarkdownToHtml(mdText) {
    if (!mdText) return '<p style="color: var(--text-muted);">Žádný obsah k zobrazení.</p>';
    
    // 1. Odstranění HTML komentářů a math syntaxe
    var clean = mdText.replace(/<!--[\s\S]*?-->/g, '');
    clean = clean.replace(/\$\$\{[\s\S]*?\}\$\$/g, '');
    clean = clean.replace(/\[Co dodělat[\s\S]*?#\)/g, '');

    var lines = clean.split('\n');
    var outHtml = [];
    var inUl = false;
    var inOl = false;

    function closeLists() {
      if (inUl) { outHtml.push('</ul>'); inUl = false; }
      if (inOl) { outHtml.push('</ol>'); inOl = false; }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        closeLists();
        continue;
      }

      // Escape základních HTML znaků před formátováním (proti XSS)
      var safeLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Formátování: tučné, kurzíva, kód
      safeLine = safeLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      safeLine = safeLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
      safeLine = safeLine.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Odrážkové seznamy (- nebo *)
      var ulMatch = safeLine.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (inOl) { outHtml.push('</ol>'); inOl = false; }
        if (!inUl) { outHtml.push('<ul>'); inUl = true; }
        outHtml.push('<li>' + ulMatch[1] + '</li>');
        continue;
      }

      // Číslované seznamy (1., 2., atd.)
      var olMatch = safeLine.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (inUl) { outHtml.push('</ul>'); inUl = false; }
        if (!inOl) { outHtml.push('<ol>'); inOl = true; }
        outHtml.push('<li>' + olMatch[1] + '</li>');
        continue;
      }

      closeLists();

      // Podnadpisy uvnitř sekce
      if (safeLine.indexOf('###') === 0) {
        outHtml.push('<h4>' + safeLine.replace(/^###\s*/, '') + '</h4>');
      } else if (safeLine.indexOf('##') === 0) {
        outHtml.push('<h4>' + safeLine.replace(/^##\s*/, '') + '</h4>');
      } else {
        outHtml.push('<p>' + safeLine + '</p>');
      }
    }
    closeLists();

    return outHtml.join('\n');
  }

  /**
   * Vyříznutí příslušné sekce (Cíle / Ověření cílů) z markdownu
   */
  function extractReadmeSection(fullMd, sectionKeywords) {
    if (!fullMd) return '';
    var lines = fullMd.split('\n');
    var capturing = false;
    var capturedLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var headerMatch = line.match(/^#{1,3}\s+(.*)$/);

      if (headerMatch) {
        var headerTitle = headerMatch[1].trim().toLowerCase();
        if (capturing) {
          // Narazili jsme na další hlavní nadpis -> končíme sekci
          break;
        }

        // Kontrola shody s klíčovými slovy (cíle, cíl, ověření cílů)
        for (var k = 0; k < sectionKeywords.length; k++) {
          if (headerTitle.indexOf(sectionKeywords[k]) !== -1) {
            capturing = true;
            break;
          }
        }
      } else if (capturing) {
        // Kontrola oddělovače ---
        if (line.trim() === '---') {
          break;
        }
        capturedLines.push(line);
      }
    }

    return capturedLines.join('\n').trim();
  }

  /**
   * Stažení a parsování README z GitHubu
   */
  function fetchAndRenderSection(repoName, sectionType, targetElement, repoUrl) {
    var cacheKey = repoName + ':' + sectionType;
    if (repoContentCache[cacheKey]) {
      targetElement.innerHTML = repoContentCache[cacheKey];
      return;
    }

    targetElement.innerHTML = '<p style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem;">⏳ Načítám aktuální znění z repozitáře GitHub…</p>';

    function tryFetch(filename, onFail) {
      var rawUrl = 'https://raw.githubusercontent.com/Vt002/' + repoName + '/main/' + filename;
      fetch(rawUrl)
        .then(function (res) {
          if (!res.ok) {
            if (onFail) return onFail();
            throw new Error('HTTP ' + res.status);
          }
          return res.text();
        })
        .then(function (mdText) {
          if (!mdText) throw new Error('Prázdný soubor');
          var keywords = sectionType === 'goals' ? ['cíle', 'cíl'] : ['ověření cílů', 'ověření'];
          var sectionMd = extractReadmeSection(mdText, keywords);
          var html = parseMarkdownToHtml(sectionMd);
          
          // Doplníme malý odkaz na GitHub na konec
          html += '<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-neon);"><a href="' + repoUrl + '" target="_blank" rel="noopener noreferrer" style="font-family: var(--font-mono); font-size: 0.8rem;">Otevřít zdrojový repozitář na GitHubu ↗</a></div>';

          repoContentCache[cacheKey] = html;
          targetElement.innerHTML = html;
        })
        .catch(function (err) {
          if (onFail) {
            onFail();
          } else {
            targetElement.innerHTML = '<p style="color: var(--status-help); font-size: 0.9rem;">⚠️ Živý text z repozitáře se nepodařilo stáhnout (offline nebo nedostupná síť).<br><a href="' + repoUrl + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 0.4rem;">Zobrazit přímo na GitHubu ↗</a></p>';
          }
        });
    }

    // Zkusíme nejprve readme.md, v případě 404 zkusíme README.md
    tryFetch('readme.md', function () {
      tryFetch('README.md', null);
    });
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
      
      svgHtml.push('<defs>');
      svgHtml.push('  <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
      svgHtml.push('</defs>');

      // Tratě (Linky)
      var pathA = 'M 90,230 C 150,230 180,110 250,110 L 570,110 C 640,110 670,230 730,230 L 1180,230';
      svgHtml.push('<path class="track-line track-a" d="' + pathA + '" />');
      svgHtml.push('<path class="track-pulse track-a" d="' + pathA + '" />');

      var pathE = 'M 90,260 L 1290,260';
      svgHtml.push('<path class="track-line track-e" d="' + pathE + '" />');
      svgHtml.push('<path class="track-pulse track-e" d="' + pathE + '" />');

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

        var dlIso = null;
        if (scheduleData && scheduleData.deadlines && scheduleData.deadlines[stId]) {
          var dlObj = scheduleData.deadlines[stId];
          dlIso = (selectedTrack !== 'ALL') ? dlObj[selectedTrack] : (dlObj.A || dlObj.E || dlObj.S);
        }
        var dlInfo = evaluateDeadline(dlIso, isDone, stRecord.completedAt, today);

        var statusClass = 'status-waiting';
        if (isDone) statusClass = 'status-done';
        else if (isWorking) statusClass = 'status-working';
        else if (isHelp) statusClass = 'status-help';

        var isCurrent = (currentStationId === stId);

        svgHtml.push('<g class="station-node" data-id="' + stId + '" tabindex="0" role="button" aria-label="Téma: ' + stDef.title + ', stav: ' + stRecord.status + ', termín: ' + dlInfo.shortText + '">');
        
        var capW = 38;
        var capX = coord.x - capW / 2;
        var capY = coord.y - coord.h / 2;
        svgHtml.push('  <rect class="station-shape ' + statusClass + '" x="' + capX + '" y="' + capY + '" width="' + capW + '" height="' + coord.h + '" rx="14" />');

        var iconChar = '•';
        if (isDone) iconChar = '✓';
        else if (isWorking) iconChar = '⚡';
        else if (isHelp) iconChar = '?';
        svgHtml.push('  <text x="' + coord.x + '" y="' + (coord.y + 5) + '" text-anchor="middle" fill="#E6F1FF" font-family="JetBrains Mono" font-size="14" font-weight="700">' + iconChar + '</text>');

        if (isCurrent) {
          var pinY = capY - 26;
          svgHtml.push('  <g class="pin-here" transform="translate(' + coord.x + ',' + pinY + ')">');
          svgHtml.push('    <path d="M 0,0 L 8,-14 A 8,8 0 1,0 -8,-14 Z" fill="#00E5FF" filter="url(#glowCyan)"/>');
          svgHtml.push('    <circle cx="0" cy="-14" r="3.5" fill="#05060F"/>');
          svgHtml.push('    <text x="0" y="-24" text-anchor="middle" fill="#00E5FF" font-family="JetBrains Mono" font-size="10" font-weight="700" letter-spacing="1">JSEM TADY</text>');
          svgHtml.push('  </g>');
        }

        var displayTitle = stDef.title;
        if (displayTitle.length > 24) {
          displayTitle = displayTitle.slice(0, 22) + '…';
        }
        svgHtml.push('  <text class="station-title-text" x="' + coord.x + '" y="' + coord.titleY + '">' + displayTitle + '</text>');

        var dlColor = '#9BB0D3';
        if (dlInfo.state === 'overdue') dlColor = '#FFA07A';
        else if (dlInfo.state === 'near') dlColor = '#FFB000';
        else if (dlInfo.state === 'done') dlColor = '#39FF88';
        svgHtml.push('  <text class="station-deadline-text" x="' + coord.x + '" y="' + (coord.titleY + 16) + '" fill="' + dlColor + '">' + dlInfo.shortText + '</text>');

        var repoUrl = mapData.repoBaseUrl + stDef.repo;
        svgHtml.push('  <a href="' + repoUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Otevřít repozitář ' + stDef.title + ' v nové záložce">');
        svgHtml.push('    <text x="' + (coord.x + 22) + '" y="' + (coord.titleY - 8) + '" fill="#00E5FF" font-family="JetBrains Mono" font-size="12" font-weight="700">↗</text>');
        svgHtml.push('  </a>');

        svgHtml.push('</g>');
      }

      svgHtml.push('</svg>');
      container.innerHTML = svgHtml.join('\n');

      var nodes = container.querySelectorAll('.station-node');
      nodes.forEach(function (node) {
        var id = node.getAttribute('data-id');
        node.addEventListener('click', function (e) {
          if (e.target.tagName.toLowerCase() === 'a' || e.target.parentElement.tagName.toLowerCase() === 'a') {
            return;
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
     * Vykreslení seznamového pohledu
     */
    renderListView: function (container, mapData, scheduleData, studentState, onStationSelect) {
      var selectedTrack = studentState.selectedTrack || 'ALL';
      var today = root.MSPStorage.getISODateToday();
      var currentStationId = this.detectCurrentStationId(mapData, studentState);

      var stationIds = [];
      if (selectedTrack !== 'ALL' && mapData.tracks[selectedTrack]) {
        stationIds = mapData.tracks[selectedTrack].stations;
      } else {
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
        html.push('    <div class="list-station-left">');
        html.push('      <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim);">' + (idx + 1) + '.</span>');
        
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
      var stDef = mapData.stations[stationId];
      if (!stDef) return;

      var stRecord = studentState.stations[stationId] || { status: 'not_started', tasks: {} };
      var selectedTrack = studentState.selectedTrack || 'ALL';
      var today = root.MSPStorage.getISODateToday();
      var dlIso = null;
      if (scheduleData && scheduleData.deadlines && scheduleData.deadlines[stationId]) {
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
      html.push('      <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--track-a); letter-spacing: 1.5px;">// DETAIL TÉMATU</div>');
      html.push('      <h2 class="details-title">' + stDef.title + '</h2>');
      html.push('    </div>');
      html.push('    <button class="btn-close-drawer" id="btn-close-drawer" aria-label="Zavřít panel (Esc)">✕</button>');
      html.push('  </div>');

      // Štítky oborů (POUZE první 3: Obor A, Obor E, Obor S, zrušeny S3, E3, T3A dle zadání)
      html.push('  <div class="details-tags-row">');
      if (stDef.trackNumbers) {
        for (var t in stDef.trackNumbers) {
          var tn = stDef.trackNumbers[t] || t;
          html.push('    <span class="track-badge badge-' + t.toLowerCase() + '">Obor ' + t + ': ' + tn + '</span>');
        }
      }
      html.push('    <span class="deadline-pill state-' + dlInfo.state + '">' + dlInfo.icon + ' ' + dlInfo.text + '</span>');
      html.push('    <a class="cyber-btn" href="' + repoUrl + '" target="_blank" rel="noopener noreferrer" style="font-size: 0.85rem;">Otevřít na GitHubu ↗</a>');
      html.push('  </div>');
      html.push('</div>');

      // Tělo draweru
      html.push('<div class="details-content">');

      // 1. KAM SMĚŘUJI? (Rozbalovací akordeony s živým textem z repozitáře)
      html.push('  <section class="formative-card q1">');
      html.push('    <h3 class="card-question-title"><span>1.</span> Kam směřuji? (Cíle a kritéria)</h3>');
      html.push('    <p style="font-size: 0.95rem; color: var(--text-muted);">Kliknutím rozbalíte aktuální znění cílů přímo ze zdrojového repozitáře:</p>');
      
      html.push('    <div class="repo-accordion-group">');
      
      // Akordeon: Cíl tématu
      html.push('      <div>');
      html.push('        <button class="cyber-accordion-btn" id="btn-toggle-goals" type="button" aria-expanded="false">');
      html.push('          <span>🎯 Cíl tématu (zobrazit z repozitáře)</span>');
      html.push('          <span class="accordion-arrow">▼</span>');
      html.push('        </button>');
      html.push('        <div class="accordion-content-box" id="box-goals" style="display: none;"></div>');
      html.push('      </div>');

      // Akordeon: Ověření cílů
      html.push('      <div>');
      html.push('        <button class="cyber-accordion-btn" id="btn-toggle-verify" type="button" aria-expanded="false">');
      html.push('          <span>🔍 Ověření cílů (zobrazit z repozitáře)</span>');
      html.push('          <span class="accordion-arrow">▼</span>');
      html.push('        </button>');
      html.push('        <div class="accordion-content-box" id="box-verify" style="display: none;"></div>');
      html.push('      </div>');

      html.push('    </div>');
      html.push('  </section>');

      // 2. KDE JSEM TEĎ? (Stav, sebehodnocení a nové rozvržení úloh)
      html.push('  <section class="formative-card q2">');
      html.push('    <h3 class="card-question-title"><span>2.</span> Kde jsem teď? (Stav a sebehodnocení)</h3>');
      
      // Stav
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

      // Sebehodnocení
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

      // Seznam úloh s velkým polem pro Vlastní komentář pod datem a známkou
      html.push('    <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;">');
      html.push('      <div class="task-summary-banner">');
      html.push('        <span id="task-completion-stat">Načítám úlohy…</span>');
      html.push('      </div>');

      html.push('      <div class="tasks-container-list" id="tasks-container-list">');
      html.push('      </div>');
      html.push('    </div>');

      html.push('  </section>');

      // 3. JAK DÁL?
      html.push('  <section class="formative-card q3">');
      html.push('    <h3 class="card-question-title"><span>3.</span> Jak dál? (Akční plán a reflexe)</h3>');
      
      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem;">');
      html.push('      <label class="control-label" for="txt-next-step">Můj nejbližší další krok k překonání překážek:</label>');
      html.push('      <textarea class="cyber-textarea" id="txt-next-step" placeholder="Např. zopakovat zapojení pull-up rezistoru, projít dokumentaci k čidlu..."></textarea>');
      html.push('    </div>');

      html.push('    <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">');
      html.push('      <label class="control-label" for="txt-notes">Moje osobní poznámky a postřehy z laboratorní práce:</label>');
      html.push('      <textarea class="cyber-textarea" id="txt-notes" placeholder="Poznámky, hodnoty součástek, čísla pinů..."></textarea>');
      html.push('    </div>');

      html.push('  </section>');

      html.push('</div>'); // /details-content

      panelElement.innerHTML = html.join('\n');

      // Obsluha akordeonů pro Cíle a Ověření cílů
      var btnGoals = panelElement.querySelector('#btn-toggle-goals');
      var boxGoals = panelElement.querySelector('#box-goals');
      var btnVerify = panelElement.querySelector('#btn-toggle-verify');
      var boxVerify = panelElement.querySelector('#box-verify');

      btnGoals.addEventListener('click', function () {
        var isOpen = boxGoals.style.display !== 'none';
        if (isOpen) {
          boxGoals.style.display = 'none';
          btnGoals.classList.remove('expanded');
          btnGoals.setAttribute('aria-expanded', 'false');
        } else {
          boxGoals.style.display = 'block';
          btnGoals.classList.add('expanded');
          btnGoals.setAttribute('aria-expanded', 'true');
          fetchAndRenderSection(stDef.repo, 'goals', boxGoals, repoUrl + '#cíl');
        }
      });

      btnVerify.addEventListener('click', function () {
        var isOpen = boxVerify.style.display !== 'none';
        if (isOpen) {
          boxVerify.style.display = 'none';
          btnVerify.classList.remove('expanded');
          btnVerify.setAttribute('aria-expanded', 'false');
        } else {
          boxVerify.style.display = 'block';
          btnVerify.classList.add('expanded');
          btnVerify.setAttribute('aria-expanded', 'true');
          fetchAndRenderSection(stDef.repo, 'verify', boxVerify, repoUrl + '#ověření-cílů');
        }
      });

      // Vykreslení seznamu úloh v novém 2-řádkovém formátu s polem "Vlastní komentář"
      this.populateTasksList(panelElement, stationId, stDef, stRecord, callbacks);

      // Naplnění textových polí
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

      // Změna stavu
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
    },

    /**
     * Vykreslení seznamu úloh bez sloupečku Úroveň a s velkým polem pro "Vlastní komentář"
     */
    populateTasksList: function (panelElement, stationId, stDef, stRecord, callbacks) {
      var container = panelElement.querySelector('#tasks-container-list');
      var statSpan = panelElement.querySelector('#task-completion-stat');
      if (!container) return;

      container.innerHTML = '';
      var tasks = stDef.tasks || [];
      var completedCount = 0;
      var totalCount = tasks.length;

      tasks.forEach(function (task) {
        var tData = (stRecord.tasks && stRecord.tasks[task.id]) || {
          done: false,
          date: '',
          grade: '',
          comment: ''
        };

        if (tData.done) completedCount++;

        var card = document.createElement('div');
        card.className = 'task-card-item';

        // 1. Horní řádek: Checkbox + Název + Datum + Známka/body
        var mainRow = document.createElement('div');
        mainRow.className = 'task-main-row';

        var titleWrap = document.createElement('div');
        titleWrap.className = 'task-title-wrap';

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

        var titleSpan = document.createElement('span');
        titleSpan.className = 'task-title-text';
        titleSpan.textContent = task.title;
        if (task.challenge) {
          var chal = document.createElement('span');
          chal.className = 'challenge-tag';
          chal.textContent = 'výzva';
          titleSpan.appendChild(chal);
        }

        titleWrap.appendChild(chk);
        titleWrap.appendChild(titleSpan);
        mainRow.appendChild(titleWrap);

        var inputsRow = document.createElement('div');
        inputsRow.className = 'task-inputs-row';

        // Datum
        var dateField = document.createElement('div');
        dateField.className = 'task-input-field';
        var dateLabel = document.createElement('span');
        dateLabel.className = 'task-mini-label';
        dateLabel.textContent = 'Datum:';
        var inDate = document.createElement('input');
        inDate.type = 'date';
        inDate.className = 'cyber-input';
        inDate.value = tData.date || '';
        inDate.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { date: inDate.value });
        });
        dateField.appendChild(dateLabel);
        dateField.appendChild(inDate);
        inputsRow.appendChild(dateField);

        // Známka / body
        var gradeField = document.createElement('div');
        gradeField.className = 'task-input-field';
        var gradeLabel = document.createElement('span');
        gradeLabel.className = 'task-mini-label';
        gradeLabel.textContent = 'Známka/body:';
        var inGrade = document.createElement('input');
        inGrade.type = 'text';
        inGrade.className = 'cyber-input';
        inGrade.maxLength = 12;
        inGrade.style.width = '110px';
        inGrade.placeholder = 'např. 1, 28/30 b';
        inGrade.value = tData.grade || '';
        inGrade.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { grade: inGrade.value.trim() });
        });
        gradeField.appendChild(gradeLabel);
        gradeField.appendChild(inGrade);
        inputsRow.appendChild(gradeField);

        mainRow.appendChild(inputsRow);
        card.appendChild(mainRow);

        // 2. Spodní řádek: Větší pole pro Vlastní komentář
        var commentRow = document.createElement('div');
        var txtComment = document.createElement('textarea');
        txtComment.className = 'task-comment-area';
        txtComment.placeholder = 'Vlastní komentář';
        txtComment.value = tData.comment || '';
        txtComment.addEventListener('change', function () {
          callbacks.onTaskChange(stationId, task.id, { comment: txtComment.value.trim() });
        });
        commentRow.appendChild(txtComment);
        card.appendChild(commentRow);

        container.appendChild(card);
      });

      if (statSpan) {
        statSpan.textContent = 'Splněno ' + completedCount + ' z ' + totalCount + ' úloh';
      }
    },

    /**
     * Zjištění ID stanice (Pin "Jsem tady")
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
          return sId;
        }
      }
      return trackStations[trackStations.length - 1];
    }
  };

  root.MSPRender = MSPRender;
})(typeof window !== 'undefined' ? window : global);
