/**
 * MAPA STUDENTSKÉHO POKROKU - VYHLEDOVÝ A RENDEROVACÍ MODUL
 * Generování inline SVG metro mapy, seznamu úloh, detailního panelu a formativních prvků.
 */
(function (root) {
  'use strict';

  var repoContentCache = {};

  var ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  var REPO_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function wrapStationTitle(title, maxLines, maxChars) {
    var words = String(title).trim().split(/\s+/);
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (cur && (cur + ' ' + w).length > maxChars) {
        lines.push(cur);
        cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      var last = lines.slice(0, maxLines - 1);
      var rest = lines.slice(maxLines - 1).join(' ');
      last.push(rest.length > maxChars - 3 ? rest.slice(0, maxChars - 3) + '…' : rest);
      lines = last;
    }
    return lines;
  }

  function evaluateDeadline(deadlineIso, isDone, completedAtIso, todayIso) {
    if (typeof deadlineIso !== 'string' || !ISO_DATE_REGEX.test(deadlineIso)) {
      deadlineIso = null;
    }
    if (typeof completedAtIso !== 'string' || !ISO_DATE_REGEX.test(completedAtIso)) {
      completedAtIso = null;
    }

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
    if (typeof repoName !== 'string' || !REPO_NAME_REGEX.test(repoName) || repoName.indexOf('..') !== -1) {
      targetElement.innerHTML = '<p style="color: var(--status-help); font-size: 0.9rem;">⚠️ Odkaz na zdrojový repozitář není platný.</p>';
      return;
    }

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
          html += '<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-neon);"><a href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer" style="font-family: var(--font-mono); font-size: 0.8rem;">Otevřít zdrojový repozitář na GitHubu ↗</a></div>';

          repoContentCache[cacheKey] = html;
          targetElement.innerHTML = html;
        })
        .catch(function (err) {
          if (onFail) {
            onFail();
          } else {
            targetElement.innerHTML = '<p style="color: var(--status-help); font-size: 0.9rem;">⚠️ Živý text z repozitáře se nepodařilo stáhnout (offline nebo nedostupná síť).<br><a href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 0.4rem;">Zobrazit přímo na GitHubu ↗</a></p>';
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
      'vyber': { x: 90, y: 260, h: 100, isBranch: false },
      'dio-mcu': { x: 250, y: 110, h: 44, isBranch: true },
      'iot': { x: 410, y: 110, h: 44, isBranch: true },
      'vyvojove': { x: 570, y: 110, h: 44, isBranch: true },
      'plc': { x: 730, y: 260, h: 100, isBranch: false },
      'dio-plc': { x: 890, y: 260, h: 100, isBranch: false },
      'senzory': { x: 1040, y: 260, h: 100, isBranch: false },
      'regulace': { x: 1180, y: 260, h: 100, isBranch: false },
      'bezpecnost': { x: 1290, y: 275, h: 70, isBranch: false }
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

      var activeTheme = (studentState && studentState.theme) || (typeof document !== 'undefined' && document.body.getAttribute('data-theme')) || 'minimal-light';
      if (activeTheme === 'scifi-rpg') activeTheme = 'scifi';
      var isScifi = (activeTheme === 'scifi');
      var isSteampunk = (activeTheme === 'steampunk');

      var filterClass = '';
      if (selectedTrack === 'A') filterClass = 'filter-a';
      else if (selectedTrack === 'E') filterClass = 'filter-e';
      else if (selectedTrack === 'S') filterClass = 'filter-s';

      var svgHtml = [];
      svgHtml.push('<svg class="metro-svg ' + filterClass + '" viewBox="' + MAP_COORDS.viewBox + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interaktivní mapa studentského pokroku">');

      svgHtml.push('<defs>');
      svgHtml.push('  <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');

      if (isScifi) {
        svgHtml.push('  <pattern id="scifiGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(14, 165, 233, 0.08)" stroke-width="1"/><circle cx="0" cy="0" r="1.2" fill="rgba(14, 165, 233, 0.25)"/></pattern>');
        svgHtml.push('  <filter id="scifiGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
      } else if (isSteampunk) {
        svgHtml.push('  <radialGradient id="steampunkDialGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#3A281B"/><stop offset="85%" stop-color="#231710"/><stop offset="100%" stop-color="#140D09"/></radialGradient>');
        svgHtml.push('  <linearGradient id="brassBezelGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E5C158"/><stop offset="35%" stop-color="#8B6F47"/><stop offset="70%" stop-color="#D4AF37"/><stop offset="100%" stop-color="#5C4524"/></linearGradient>');
      }
      svgHtml.push('</defs>');

      // Pozadí a grafické prvky specifické pro Skin
      if (isScifi) {
        svgHtml.push('<rect width="1360" height="440" fill="url(#scifiGrid)"/>');
        // Horní telemetrická lišta
        svgHtml.push('<g opacity="0.8" font-family="JetBrains Mono" font-size="10">');
        svgHtml.push('  <text x="50" y="24" fill="rgba(14, 165, 233, 0.85)">[ NAV-SYS // SECTOR-SPŠELIT-AUT ]</text>');
        svgHtml.push('  <text x="680" y="24" fill="#E2E8F0" font-weight="700" letter-spacing="2" text-anchor="middle">ORBITÁLNÍ LETOVÝ KORIDOR &amp; TELEMETRIE TÉMAT</text>');
        svgHtml.push('  <text x="1310" y="24" fill="#10B981" text-anchor="end">● TELEMETRY LINK: ONLINE</text>');
        svgHtml.push('  <line x1="50" y1="32" x2="1310" y2="32" stroke="rgba(14, 165, 233, 0.3)" stroke-width="1" stroke-dasharray="8 6"/>');
        svgHtml.push('</g>');
        // Vodicí linie orbitálních hladin
        svgHtml.push('<line x1="90" y1="110" x2="1290" y2="110" stroke="rgba(14, 165, 233, 0.12)" stroke-dasharray="3 6"/>');
        svgHtml.push('<text x="95" y="103" fill="rgba(14, 165, 233, 0.55)" font-family="JetBrains Mono" font-size="9">ORBIT-A // ALT: 110 KM</text>');
        svgHtml.push('<line x1="90" y1="260" x2="1290" y2="260" stroke="rgba(249, 115, 22, 0.12)" stroke-dasharray="3 6"/>');
        svgHtml.push('<text x="95" y="253" fill="rgba(249, 115, 22, 0.55)" font-family="JetBrains Mono" font-size="9">AXIS-E/S // ALT: 260 KM</text>');
        // Spodní telemetrické souřadnice
        svgHtml.push('<g opacity="0.65" font-family="JetBrains Mono" font-size="9">');
        svgHtml.push('  <line x1="50" y1="416" x2="1310" y2="416" stroke="rgba(14, 165, 233, 0.2)" stroke-dasharray="10 8"/>');
        svgHtml.push('  <text x="50" y="430" fill="#64748B">POS: LAT 50°18\'N LON 16°19\'E | TRAJECTORY: STABLE</text>');
        svgHtml.push('  <text x="1310" y="430" fill="#64748B" text-anchor="end">SPŠELIT DOBRUŠKA // SPACE TELEMETRY LAB</text>');
        svgHtml.push('</g>');
      } else if (isSteampunk) {
        // Viktoriánský zdobný mosazný rám s nýty v rozích
        svgHtml.push('<rect x="14" y="14" width="1332" height="412" fill="none" stroke="#8B6F47" stroke-width="2" rx="6"/>');
        svgHtml.push('<rect x="18" y="18" width="1324" height="404" fill="none" stroke="rgba(212, 175, 55, 0.35)" stroke-width="1" stroke-dasharray="6 6"/>');
        // Mosazné nýty v rozích
        var rivets = [[28, 28], [1332, 28], [28, 412], [1332, 412]];
        for (var r = 0; r < rivets.length; r++) {
          svgHtml.push('<circle cx="' + rivets[r][0] + '" cy="' + rivets[r][1] + '" r="5" fill="#D4AF37" stroke="#5C4524" stroke-width="1.5"/>');
          svgHtml.push('<circle cx="' + rivets[r][0] + '" cy="' + rivets[r][1] + '" r="1.5" fill="#140D09"/>');
        }
        // Záhlaví kartuše
        svgHtml.push('<g font-family="Georgia, serif" fill="#D4AF37" text-anchor="middle">');
        svgHtml.push('  <text x="680" y="27" font-size="11.5" font-weight="700" letter-spacing="1.5">⚙ PARNÍ A ELEKTROMECHANICKÝ ROZVOD // TECHNICKÉ DÍLNY A LABORATOŘE ⚙</text>');
        svgHtml.push('</g>');

        // MOSAZNÉ MANOMETRY (vlevo a vpravo nahoře)
        var gauges = [[85, 78, -38], [1275, 78, 25]];
        for (var g = 0; g < gauges.length; g++) {
          var gx = gauges[g][0];
          var gy = gauges[g][1];
          var needleRad = gauges[g][2] * Math.PI / 180;
          svgHtml.push('  <g>');
          svgHtml.push('    <circle cx="' + gx + '" cy="' + gy + '" r="20" fill="url(#brassBezelGrad)" stroke="#5C4524" stroke-width="2"/>');
          svgHtml.push('    <circle cx="' + gx + '" cy="' + gy + '" r="14" fill="#E8DCC0" stroke="#5C4524" stroke-width="1"/>');
          for (var tk = 0; tk < 8; tk++) {
            var tAng = (tk / 8) * 2 * Math.PI;
            svgHtml.push('    <line x1="' + (gx + Math.cos(tAng) * 11).toFixed(1) + '" y1="' + (gy + Math.sin(tAng) * 11).toFixed(1) + '" x2="' + (gx + Math.cos(tAng) * 13.5).toFixed(1) + '" y2="' + (gy + Math.sin(tAng) * 13.5).toFixed(1) + '" stroke="#5C4524" stroke-width="1"/>');
          }
          svgHtml.push('    <line x1="' + gx + '" y1="' + gy + '" x2="' + (gx + Math.cos(needleRad) * 10).toFixed(1) + '" y2="' + (gy + Math.sin(needleRad) * 10).toFixed(1) + '" stroke="#A32020" stroke-width="1.6" stroke-linecap="round"/>');
          svgHtml.push('    <circle cx="' + gx + '" cy="' + gy + '" r="2" fill="#5C4524"/>');
          svgHtml.push('  </g>');
        }

        // OZUBENÁ KOLA (páry v obou dolních rozích)
        var gearPairs = [[62, 396, 13, 92, 406, 8], [1298, 396, 13, 1268, 406, 8]];
        for (var gp = 0; gp < gearPairs.length; gp++) {
          for (var gg = 0; gg < 2; gg++) {
            var cx = gearPairs[gp][gg * 4];
            var cy = gearPairs[gp][gg * 4 + 1];
            var cr = gearPairs[gp][gg * 4 + 2];
            svgHtml.push('  <g>');
            svgHtml.push('    <circle cx="' + cx + '" cy="' + cy + '" r="' + (cr + 3) + '" fill="#5C4524"/>');
            for (var th = 0; th < 8; th++) {
              var gAng = (th / 8) * 2 * Math.PI;
              svgHtml.push('    <line x1="' + (cx + Math.cos(gAng) * cr).toFixed(1) + '" y1="' + (cy + Math.sin(gAng) * cr).toFixed(1) + '" x2="' + (cx + Math.cos(gAng) * (cr + 3)).toFixed(1) + '" y2="' + (cy + Math.sin(gAng) * (cr + 3)).toFixed(1) + '" stroke="#8B6F47" stroke-width="2.5"/>');
            }
            svgHtml.push('    <circle cx="' + cx + '" cy="' + cy + '" r="' + cr + '" fill="url(#brassBezelGrad)" stroke="#5C4524" stroke-width="1"/>');
            svgHtml.push('    <circle cx="' + cx + '" cy="' + cy + '" r="' + (cr / 3).toFixed(1) + '" fill="#140D09" stroke="#D4AF37" stroke-width="1"/>');
            svgHtml.push('  </g>');
          }
        }

        // TÁHLO S DRŽÁKY (pod spodní tratí)
        svgHtml.push('  <line x1="120" y1="392" x2="1240" y2="392" stroke="#8B6F47" stroke-width="3" stroke-linecap="round"/>');
        for (var rod = 120; rod <= 1240; rod += 160) {
          svgHtml.push('  <circle cx="' + rod + '" cy="392" r="3" fill="#D4AF37" stroke="#5C4524" stroke-width="1"/>');
        }

        // PŘEPÍNAČE (mosazné desky s páčkou, nasazené na táhlo)
        var switchDefs = [[460, 30], [900, -25]];
        for (var sw = 0; sw < switchDefs.length; sw++) {
          var sx = switchDefs[sw][0];
          var sDeg = switchDefs[sw][1];
          var sRad = sDeg * Math.PI / 180;
          svgHtml.push('  <g>');
          svgHtml.push('    <rect x="' + (sx - 14) + '" y="384" width="28" height="16" rx="3" fill="url(#brassBezelGrad)" stroke="#5C4524" stroke-width="1.5"/>');
          svgHtml.push('    <line x1="' + sx + '" y1="392" x2="' + (sx + Math.cos(sRad) * 14).toFixed(1) + '" y2="' + (392 + Math.sin(sRad) * 14).toFixed(1) + '" stroke="#140D09" stroke-width="3" stroke-linecap="round"/>');
          svgHtml.push('    <circle cx="' + sx + '" cy="392" r="2.5" fill="#D4AF37"/>');
          svgHtml.push('  </g>');
        }
      }

      // Tratě (Linky)
      var pathA = 'M 90,230 C 150,230 180,110 250,110 L 570,110 C 640,110 670,230 730,230 L 1180,230';
      var pathE = 'M 90,260 L 1290,260';
      var pathS = 'M 90,290 L 1290,290';

      if (isSteampunk) {
        // Steampunk: Masivní litinové a měděné parní potrubí s přírubami
        // 1. Spodní vrstva - litinové pouzdro trubek
        svgHtml.push('<path class="track-line track-a" d="' + pathA + '" stroke="#120D0A" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />');
        svgHtml.push('<path class="track-line track-e" d="' + pathE + '" stroke="#120D0A" stroke-width="14" stroke-linecap="round" />');
        svgHtml.push('<path class="track-line track-s" d="' + pathS + '" stroke="#120D0A" stroke-width="14" stroke-linecap="round" />');
        // 2. Vnitřní parní / elektrické vedení
        svgHtml.push('<path class="track-line track-a" d="' + pathA + '" stroke-width="7" />');
        svgHtml.push('<path class="track-line track-e" d="' + pathE + '" stroke-width="7" />');
        svgHtml.push('<path class="track-line track-s" d="' + pathS + '" stroke-width="7" />');
        // 3. Spojovací příruby na potrubí
        var flanges = [170, 330, 490, 650, 810, 960, 1110, 1230];
        for (var fl = 0; fl < flanges.length; fl++) {
          var fx = flanges[fl];
          svgHtml.push('<rect x="' + (fx - 2) + '" y="253" width="4" height="14" fill="#D4AF37" stroke="#5C4524" stroke-width="1" />');
          svgHtml.push('<rect x="' + (fx - 2) + '" y="283" width="4" height="14" fill="#D4AF37" stroke="#5C4524" stroke-width="1" />');
        }
      } else if (isScifi) {
        // Sci-fi: Přesné vektorové koridory a telemetrické linky
        svgHtml.push('<path class="track-line track-a" d="' + pathA + '" stroke-width="5" filter="url(#scifiGlow)" />');
        svgHtml.push('<path class="track-pulse track-a" d="' + pathA + '" />');
        svgHtml.push('<path class="track-line track-e" d="' + pathE + '" stroke-width="5" />');
        svgHtml.push('<path class="track-line track-s" d="' + pathS + '" stroke-width="5" />');
        // Vektorové směrové šipky podél trati A
        svgHtml.push('<g fill="var(--track-a)" opacity="0.6">');
        svgHtml.push('  <polygon points="190,140 197,135 190,130" />');
        svgHtml.push('  <polygon points="330,110 337,105 330,100" />');
        svgHtml.push('  <polygon points="490,110 497,105 490,100" />');
        svgHtml.push('  <polygon points="650,140 657,145 650,150" />');
        svgHtml.push('  <polygon points="960,230 967,225 960,220" />');
        svgHtml.push('</g>');
      } else {
        // Cyberpunk a Minimalistické skiny: Původní čistá metro mapa
        svgHtml.push('<path class="track-line track-a" d="' + pathA + '" />');
        svgHtml.push('<path class="track-pulse track-a" d="' + pathA + '" />');
        svgHtml.push('<path class="track-line track-e" d="' + pathE + '" />');
        svgHtml.push('<path class="track-pulse track-e" d="' + pathE + '" />');
        svgHtml.push('<path class="track-line track-s" d="' + pathS + '" />');
        svgHtml.push('<path class="track-pulse track-s" d="' + pathS + '" />');
      }

      // Mapování indexů pro waypointy Sci-fi
      var waypointIds = ['vyber', 'dio-mcu', 'iot', 'vyvojove', 'plc', 'dio-plc', 'senzory', 'regulace', 'bezpecnost'];

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
          dlIso = (selectedTrack !== 'ALL') ? dlObj[selectedTrack] : null;
        }
        var dlInfo = evaluateDeadline(dlIso, isDone, stRecord.completedAt, today);

        var statusClass = 'status-waiting';
        if (isDone) statusClass = 'status-done';
        else if (isWorking) statusClass = 'status-working';
        else if (isHelp) statusClass = 'status-help';

        var isCurrent = (currentStationId === stId);

        svgHtml.push('<g class="station-node" data-id="' + escapeHtml(stId) + '" tabindex="0" role="button" aria-label="Téma: ' + escapeHtml(stDef.title) + ', stav: ' + escapeHtml(stRecord.status) + ', termín: ' + escapeHtml(dlInfo.shortText) + '">');

        var capW = 38;
        var capX = coord.x - capW / 2;
        var capY = coord.y - coord.h / 2;
        var capBottom = capY + coord.h;

        // Vykreslení názvu tématu NAD obdélníčkem
        var titleLines = wrapStationTitle(stDef.title, 3, 16);
        var titleBottomY = coord.isBranch ? 78 : (coord.y > 200 ? 198 : capY - 10);
        var topTitleY = titleBottomY - (titleLines.length - 1) * 15;

        for (var tl = 0; tl < titleLines.length; tl++) {
          var lineY = titleBottomY - (titleLines.length - 1 - tl) * 15;
          svgHtml.push('  <text class="station-title-text" x="' + coord.x + '" y="' + lineY + '">' + escapeHtml(titleLines[tl]) + '</text>');
        }

        if (isSteampunk) {
          // Steampunk: Viktoriánský manometr / tlakoměr s mosazným rámečkem
          svgHtml.push('  <rect x="' + (capX - 2) + '" y="' + (capY - 2) + '" width="' + (capW + 4) + '" height="' + (coord.h + 4) + '" rx="16" fill="url(#brassBezelGrad)" stroke="#5C4524" stroke-width="1.5" />');
          svgHtml.push('  <rect class="station-shape ' + statusClass + '" x="' + capX + '" y="' + capY + '" width="' + capW + '" height="' + coord.h + '" rx="14" fill="url(#steampunkDialGrad)" />');
          // Nýtky po obvodu
          svgHtml.push('  <circle cx="' + coord.x + '" cy="' + (capY + 3) + '" r="1.5" fill="#D4AF37"/>');
          svgHtml.push('  <circle cx="' + coord.x + '" cy="' + (capY + coord.h - 3) + '" r="1.5" fill="#D4AF37"/>');
          // Ručička manometru indikující stav
          var needleAngle = -90; // waiting
          if (isDone) needleAngle = 45;      // zelená zóna plného tlaku
          else if (isWorking) needleAngle = 0; // provozní tlak
          else if (isHelp) needleAngle = -45;  // varovný tlak
          svgHtml.push('  <g transform="translate(' + coord.x + ',' + coord.y + ') rotate(' + needleAngle + ')">');
          svgHtml.push('    <line x1="0" y1="0" x2="0" y2="-12" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" />');
          svgHtml.push('    <circle cx="0" cy="0" r="3" fill="#8B6F47" stroke="#D4AF37" stroke-width="1" />');
          svgHtml.push('  </g>');
        } else if (isScifi) {
          // Sci-fi: Waypoint modul s přesnými rohovými závorkami a telemetrickým kódem
          var wpIdx = waypointIds.indexOf(stId) + 1;
          var wpTag = 'WP-' + (wpIdx < 10 ? '0' + wpIdx : wpIdx);
          var tagY = isCurrent ? (topTitleY - 32) : (topTitleY - 8);
          svgHtml.push('  <text class="scifi-waypoint-tag" x="' + coord.x + '" y="' + tagY + '" text-anchor="middle" fill="var(--track-a)">[' + wpTag + ']</text>');
          // Rohové zaměřovací závorky kolem waypointu
          var bOff = 4;
          svgHtml.push('  <path d="M ' + (capX - bOff) + ',' + (capY + 6) + ' L ' + (capX - bOff) + ',' + (capY - bOff) + ' L ' + (capX + 6) + ',' + (capY - bOff) + '" fill="none" stroke="rgba(14, 165, 233, 0.6)" stroke-width="1.5" />');
          svgHtml.push('  <path d="M ' + (capX + capW - 6) + ',' + (capY - bOff) + ' L ' + (capX + capW + bOff) + ',' + (capY - bOff) + ' L ' + (capX + capW + bOff) + ',' + (capY + 6) + '" fill="none" stroke="rgba(14, 165, 233, 0.6)" stroke-width="1.5" />');
          svgHtml.push('  <path d="M ' + (capX - bOff) + ',' + (capY + coord.h - 6) + ' L ' + (capX - bOff) + ',' + (capY + coord.h + bOff) + ' L ' + (capX + 6) + ',' + (capY + coord.h + bOff) + '" fill="none" stroke="rgba(14, 165, 233, 0.6)" stroke-width="1.5" />');
          svgHtml.push('  <path d="M ' + (capX + capW - 6) + ',' + (capY + coord.h + bOff) + ' L ' + (capX + capW + bOff) + ',' + (capY + coord.h + bOff) + ' L ' + (capX + capW + bOff) + ',' + (capY + coord.h - 6) + '" fill="none" stroke="rgba(14, 165, 233, 0.6)" stroke-width="1.5" />');

          svgHtml.push('  <rect class="station-shape ' + statusClass + '" x="' + capX + '" y="' + capY + '" width="' + capW + '" height="' + coord.h + '" rx="10" />');

          var iconChar = '•';
          if (isDone) iconChar = '✓';
          else if (isWorking) iconChar = '⚡';
          else if (isHelp) iconChar = '?';
          svgHtml.push('  <text x="' + coord.x + '" y="' + (coord.y + 5) + '" text-anchor="middle" fill="#E2E8F0" font-family="JetBrains Mono" font-size="14" font-weight="700">' + iconChar + '</text>');
        } else {
          // Standardní metro kapsle pro Cyberpunk a Minimalistické skiny
          svgHtml.push('  <rect class="station-shape ' + statusClass + '" x="' + capX + '" y="' + capY + '" width="' + capW + '" height="' + coord.h + '" rx="14" />');
          var iconChar = '•';
          if (isDone) iconChar = '✓';
          else if (isWorking) iconChar = '⚡';
          else if (isHelp) iconChar = '?';
          svgHtml.push('  <text x="' + coord.x + '" y="' + (coord.y + 5) + '" text-anchor="middle" fill="#E6F1FF" font-family="JetBrains Mono" font-size="14" font-weight="700">' + iconChar + '</text>');
        }

        // Ukazatel "JSEM TADY"
        if (isCurrent) {
          var pinY = topTitleY - 8;
          if (isScifi) {
            // Sci-fi: Zaměřovací radarový cíl
            svgHtml.push('  <g class="pin-here" transform="translate(' + coord.x + ',' + pinY + ')">');
            svgHtml.push('    <circle cx="0" cy="-6" r="10" fill="none" stroke="var(--track-a)" stroke-width="1.5" stroke-dasharray="4 2" />');
            svgHtml.push('    <circle cx="0" cy="-6" r="3.5" fill="var(--track-a)" filter="url(#scifiGlow)" />');
            svgHtml.push('    <line x1="-15" y1="-6" x2="-8" y2="-6" stroke="var(--track-a)" stroke-width="1.5"/>');
            svgHtml.push('    <line x1="8" y1="-6" x2="15" y2="-6" stroke="var(--track-a)" stroke-width="1.5"/>');
            svgHtml.push('    <text x="0" y="-20" text-anchor="middle" fill="var(--track-a)" font-family="JetBrains Mono" font-size="9.5" font-weight="700" letter-spacing="1">⌖ TARGET LOCK</text>');
            svgHtml.push('  </g>');
          } else if (isSteampunk) {
            // Steampunk: Mosazná olovnice / kompas s ozubeným kolem
            svgHtml.push('  <g class="pin-here" transform="translate(' + coord.x + ',' + pinY + ')">');
            svgHtml.push('    <path d="M 0,0 L 7,-13 L -7,-13 Z" fill="#D4AF37" stroke="#5C4524" stroke-width="1"/>');
            svgHtml.push('    <circle cx="0" cy="-14" r="5" fill="#8B6F47" stroke="#D4AF37" stroke-width="1.5"/>');
            svgHtml.push('    <text x="0" y="-24" text-anchor="middle" fill="#D4AF37" font-family="Georgia, serif" font-size="9.5" font-weight="700" letter-spacing="0.5">⚓ KOTVA</text>');
            svgHtml.push('  </g>');
          } else {
            // Cyberpunk & Minimalistické skiny
            svgHtml.push('  <g class="pin-here" transform="translate(' + coord.x + ',' + pinY + ')">');
            svgHtml.push('    <path d="M 0,0 L 8,-14 A 8,8 0 1,0 -8,-14 Z" fill="var(--track-a)" filter="url(#glowCyan)"/>');
            svgHtml.push('    <circle cx="0" cy="-14" r="3.5" fill="var(--bg-deep)"/>');
            svgHtml.push('    <text x="0" y="-24" text-anchor="middle" fill="var(--track-a)" font-family="JetBrains Mono" font-size="10" font-weight="700" letter-spacing="1">JSEM TADY</text>');
            svgHtml.push('  </g>');
          }
        }

        // Prvky POD obdélníčkem: Termín, Odkaz na podrobnosti, Odkaz na GitHub
        var dlColor = '#9BB0D3';
        if (dlInfo.state === 'overdue') dlColor = isSteampunk ? '#EF4444' : '#FFA07A';
        else if (dlInfo.state === 'near') dlColor = '#FFB000';
        else if (dlInfo.state === 'done') dlColor = isSteampunk ? '#22C55E' : '#39FF88';
        var dlText = (selectedTrack === 'ALL') ? '' : escapeHtml(dlInfo.shortText);
        svgHtml.push('  <text class="station-deadline-text" x="' + coord.x + '" y="' + (coord.titleY + 16) + '" fill="' + dlColor + '">' + dlText + '</text>');

        svgHtml.push('  <g class="station-btn-details" role="button" tabindex="0" aria-label="Zobrazit podrobnosti k tématu ' + escapeHtml(stDef.title) + '">');
        svgHtml.push('    <text class="station-action-link link-details" x="' + coord.x + '" y="' + (capBottom + 33) + '">Podrobnosti</text>');
        svgHtml.push('  </g>');

        var repoUrl = mapData.repoBaseUrl + stDef.repo;
        svgHtml.push('  <a href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer" class="station-btn-github" aria-label="Otevřít repozitář ' + escapeHtml(stDef.title) + ' na GitHubu">');
        svgHtml.push('    <text class="station-action-link link-github" x="' + coord.x + '" y="' + (capBottom + 48) + '">GitHub ↗</text>');
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
        var repoUrl = mapData.repoBaseUrl + stDef.repo;

        html.push('<li class="list-station-card">');
        html.push('  <div class="list-station-header" data-id="' + stId + '" role="button" tabindex="0" aria-expanded="false">');
        html.push('    <div class="list-station-left">');
        html.push('      <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim);">' + (idx + 1) + '.</span>');

        html.push('      <div class="station-badge-group">');
        for (var trk in stDef.trackNumbers) {
          var num = stDef.trackNumbers[trk] || trk;
          html.push('        <span class="track-badge badge-' + escapeHtml(trk.toLowerCase()) + '" title="Číslo v trase: ' + escapeHtml(num) + '">' + escapeHtml(num) + '</span>');
        }
        html.push('      </div>');

        html.push('      <span class="list-station-title">' + escapeHtml(stDef.title) + '</span>');
        if (isCurrent) {
          html.push('      <span style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--track-a); color: #05060F; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 2px;">JSEM TADY</span>');
        }
        html.push('    </div>');

        html.push('    <div class="list-station-right">');
        var pillContent = (selectedTrack === 'ALL') ? '' : escapeHtml(dlInfo.icon) + ' ' + escapeHtml(dlInfo.shortText);
        html.push('      <span class="deadline-pill state-' + escapeHtml(dlInfo.state) + '">' + pillContent + '</span>');
        html.push('      <a class="repo-link-icon" href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Otevřít repozitář ' + escapeHtml(stDef.title) + ' v nové záložce">↗</a>');
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
      html.push('      <h2 class="details-title">' + escapeHtml(stDef.title) + '</h2>');
      html.push('    </div>');
      html.push('    <button class="btn-close-drawer" id="btn-close-drawer" aria-label="Zavřít panel (Esc)">✕</button>');
      html.push('  </div>');

      // Štítky oborů (POUZE první 3: Obor A, Obor E, Obor S, zrušeny S3, E3, T3A dle zadání)
      html.push('  <div class="details-tags-row">');
      if (stDef.trackNumbers) {
        for (var t in stDef.trackNumbers) {
          var tn = stDef.trackNumbers[t] || t;
          html.push('    <span class="track-badge badge-' + escapeHtml(t.toLowerCase()) + '">Obor ' + escapeHtml(t) + ': ' + escapeHtml(tn) + '</span>');
        }
      }
      html.push('    <span class="deadline-pill state-' + escapeHtml(dlInfo.state) + '">' + escapeHtml(dlInfo.icon) + ' ' + escapeHtml(dlInfo.text) + '</span>');
      html.push('    <a class="cyber-btn" href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size: 0.85rem;">Otevřít na GitHubu ↗</a>');
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
        { id: 'working', label: 'Pracuji na tom' },
        { id: 'done', label: 'Zvládám' },
        { id: 'help', label: 'Potřebuji pomoc' }
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
        { id: 'certain', label: 'Zvládl/a jsem jistě' },
        { id: 'with_help', label: 'S dopomocí' },
        { id: 'unclear', label: 'Zůstávají nejasnosti' }
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
