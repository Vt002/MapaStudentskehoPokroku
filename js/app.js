/**
 * MAPA STUDENTSKÉHO POKROKU - HLAVNÍ APLIKAČNÍ LOGIKA
 * Inicializace, synchronizace termínů, přepínání skinů/vzhledů, nápověda a události.
 */
(function (root) {
  'use strict';

  var mapData = root.MAP_DATA;
  var scheduleData = root.SCHEDULE_DATA || {};
  var storage = root.MSPStorage;
  var render = root.MSPRender;

  var currentActiveStationId = null;

  function init() {
    console.log('[MSPApp] Inicializuji Mapu studentského pokroku...');

    var state = storage.load();

    // Nastavení aktivního skinu/tématu
    applyTheme(state.theme || 'cyberpunk');

    // Načtení centrálních termínů ze schedule.json (pokud běžíme přes HTTP/HTTPS)
    syncScheduleData(function (updatedSchedule) {
      if (updatedSchedule) {
        scheduleData = updatedSchedule;
      }
      updateScheduleBanner(scheduleData);
      renderAllViews();
    });

    setupGlobalEventListeners();
    updateScheduleBanner(scheduleData);
    renderAllViews();
  }

  function applyTheme(themeName) {
    var validThemes = ['cyberpunk', 'minimal-light', 'minimal-dark', 'scifi-rpg'];
    var activeTheme = validThemes.indexOf(themeName) !== -1 ? themeName : 'cyberpunk';
    document.body.setAttribute('data-theme', activeTheme);
    var sel = document.getElementById('theme-selector');
    if (sel) {
      sel.value = activeTheme;
    }
  }

  /**
   * Pokus o načtení termínů (nejprve z editoru vyučujícího v localStorage, pak stažení či zrcadlo)
   */
  function syncScheduleData(callback) {
    var isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    var config = root.APP_CONFIG || {};
    var url = config.SCHEDULE_URL;
    var timeoutMs = config.FETCH_TIMEOUT_MS || 3500;

    // 1. Zkontrolujeme, zda existují lokálně uložené úpravy termínů z Editoru vyučujícího
    var teacherSchedule = null;
    try {
      var raw = localStorage.getItem('msp:teacher_schedule');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.deadlines) {
          teacherSchedule = parsed;
        }
      }
    } catch (e) { /* ignore */ }

    // Pokud vyučující v tomto prohlížeči upravil termíny, mají okamžitou prioritu
    if (teacherSchedule) {
      return callback(teacherSchedule);
    }

    // 2. Pokud běžíme lokálně z disku (file://)
    if (!isHttp || !url) {
      try {
        var cachedRaw = localStorage.getItem('msp:cached_schedule');
        if (cachedRaw) {
          var cachedParsed = JSON.parse(cachedRaw);
          if (cachedParsed && cachedParsed.deadlines) {
            return callback(cachedParsed);
          }
        }
      } catch (e) { /* ignore */ }
      return callback(scheduleData);
    }

    // 3. Pokus o stažení centrálního schedule.json přes síť
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    fetch(url, { signal: controller.signal, cache: 'no-cache' })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (json && json.schemaVersion && json.deadlines) {
          try {
            localStorage.setItem('msp:cached_schedule', JSON.stringify(json));
          } catch (e) { /* ignore */ }
          callback(json);
        } else {
          throw new Error('Nevalidní schéma staženého schedule.json');
        }
      })
      .catch(function (err) {
        clearTimeout(timer);
        console.warn('[MSPApp] Nepodařilo se stáhnout centrální schedule.json, použito lokální zrcadlo:', err.message);
        try {
          var cached = localStorage.getItem('msp:cached_schedule');
          if (cached) {
            var parsed = JSON.parse(cached);
            return callback(parsed);
          }
        } catch (e) { /* ignore */ }
        callback(scheduleData);
      });
  }

  function updateScheduleBanner(sched) {
    var banner = document.getElementById('sync-status-text');
    if (!banner || !sched) return;
    var schoolYear = sched.schoolYear || '2026/2027';
    var updated = render.formatDateCZ(sched.updatedAt, true) || 'aktuální';
    banner.textContent = 'Termíny: školní rok ' + schoolYear + ', aktualizováno ' + updated;
  }

  /**
   * Kompletní překreslení mapy, seznamu a ukazatele pokroku
   */
  function renderAllViews() {
    var state = storage.load();
    var mapContainer = document.getElementById('metro-map-container');
    var listContainer = document.getElementById('stations-list-container');
    var trackProgressContainer = document.getElementById('track-progress-banner');

    // 1. Zvýraznění aktivního tlačítka oboru
    var trackBtns = document.querySelectorAll('.cyber-btn-track');
    trackBtns.forEach(function (btn) {
      var trk = btn.getAttribute('data-track');
      if (trk === state.selectedTrack) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // 2. Přepínač pohledu (Mapa vs. Seznam)
    var btnViewMap = document.getElementById('btn-view-map');
    var btnViewList = document.getElementById('btn-view-list');
    var isMap = (state.activeView !== 'list');

    if (btnViewMap && btnViewList) {
      btnViewMap.classList.toggle('active', isMap);
      btnViewList.classList.toggle('active', !isMap);
      btnViewMap.setAttribute('aria-pressed', isMap ? 'true' : 'false');
      btnViewList.setAttribute('aria-pressed', isMap ? 'false' : 'true');
    }

    if (mapContainer && listContainer) {
      mapContainer.style.display = isMap ? 'block' : 'none';
      listContainer.style.display = isMap ? 'none' : 'block';
    }

    // 3. Vykreslení SVG mapy
    if (mapContainer && isMap) {
      render.renderSVGMap(mapContainer, mapData, scheduleData, state, openStationDetails);
    }

    // 4. Vykreslení Seznamu
    if (listContainer && !isMap) {
      render.renderListView(listContainer, mapData, scheduleData, state, openStationDetails);
    }

    // 5. Ukazatel pokroku trati (A, E, S)
    if (trackProgressContainer) {
      renderTrackProgress(trackProgressContainer, state);
    }

    // 6. Pokud je otevřen detail, zaktualizovat jeho obsah
    if (currentActiveStationId) {
      var panel = document.getElementById('details-drawer');
      if (panel && panel.classList.contains('open')) {
        renderStationDetails(currentActiveStationId);
      }
    }
  }

  function renderTrackProgress(container, state) {
    var trkId = state.selectedTrack;
    if (!trkId || trkId === 'ALL') {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    var trkDef = mapData.tracks[trkId];
    if (!trkDef) return;

    var stationList = trkDef.stations;
    var total = stationList.length;
    var completed = 0;

    stationList.forEach(function (sId) {
      var rec = state.stations[sId];
      if (rec && rec.status === 'done') {
        completed++;
      }
    });

    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    var titleEl = container.querySelector('#track-progress-title');
    var metaEl = container.querySelector('#track-progress-meta');
    var fillEl = container.querySelector('#track-progress-fill');
    var pctEl = container.querySelector('#track-progress-pct');

    if (titleEl) titleEl.textContent = trkDef.name;
    if (metaEl) metaEl.textContent = 'Zvládnuto ' + completed + ' z ' + total + ' témat trasy';
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }

  /**
   * Otevření a obsluha detailního panelu
   */
  function openStationDetails(stationId) {
    currentActiveStationId = stationId;
    var overlay = document.getElementById('details-overlay');
    var panel = document.getElementById('details-drawer');

    if (!overlay || !panel) return;

    renderStationDetails(stationId);

    overlay.classList.add('open');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    var btnClose = panel.querySelector('#btn-close-drawer');
    if (btnClose) btnClose.focus();
  }

  function closeStationDetails() {
    var overlay = document.getElementById('details-overlay');
    var panel = document.getElementById('details-drawer');
    if (overlay) overlay.classList.remove('open');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
    currentActiveStationId = null;
    renderAllViews();
  }

  function renderStationDetails(stationId) {
    var panel = document.getElementById('details-drawer');
    if (!panel) return;

    var state = storage.load();

    render.renderDetailsPanel(panel, stationId, mapData, scheduleData, state, {
      onClose: closeStationDetails,
      onFieldChange: function (stId, field, value) {
        var patch = {};
        patch[field] = value;
        storage.updateStation(stId, patch);
        renderAllViews();
      },
      onTaskChange: function (stId, taskId, taskPatch) {
        storage.updateTask(stId, taskId, taskPatch);
        renderAllViews();
      }
    });
  }

  /**
   * Globální posluchače událostí
   */
  function setupGlobalEventListeners() {
    // 1. Filtr oboru (A / E / S / ALL)
    var trackBtns = document.querySelectorAll('.cyber-btn-track');
    trackBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var trk = btn.getAttribute('data-track');
        var state = storage.load();
        state.selectedTrack = trk;
        storage.save(state);
        renderAllViews();
      });
    });

    // 2. Přepínač skinu / vzhledu (Cyberpunk, Minimal světlý, Minimal tmavý, Sci-fi RPG)
    var themeSel = document.getElementById('theme-selector');
    if (themeSel) {
      themeSel.addEventListener('change', function () {
        var selectedTheme = themeSel.value;
        applyTheme(selectedTheme);
        var state = storage.load();
        state.theme = selectedTheme;
        storage.save(state);
      });
    }

    // 3. Přepínač pohledu Mapa / Seznam
    var btnViewMap = document.getElementById('btn-view-map');
    var btnViewList = document.getElementById('btn-view-list');
    if (btnViewMap) {
      btnViewMap.addEventListener('click', function () {
        var state = storage.load();
        state.activeView = 'map';
        storage.save(state);
        renderAllViews();
      });
    }
    if (btnViewList) {
      btnViewList.addEventListener('click', function () {
        var state = storage.load();
        state.activeView = 'list';
        storage.save(state);
        renderAllViews();
      });
    }

    // 4. Okno Nápovědy
    var btnOpenHelp = document.getElementById('btn-open-help');
    var helpModal = document.getElementById('help-modal');
    var modalBackdrop = document.getElementById('modal-backdrop');
    var btnCloseHelp = document.getElementById('btn-close-help');

    function openHelpModal() {
      if (helpModal && modalBackdrop) {
        helpModal.classList.add('open');
        modalBackdrop.classList.add('open');
      }
    }
    function closeHelpModal() {
      if (helpModal && modalBackdrop) {
        helpModal.classList.remove('open');
        modalBackdrop.classList.remove('open');
      }
    }

    if (btnOpenHelp) btnOpenHelp.addEventListener('click', openHelpModal);
    if (btnCloseHelp) btnCloseHelp.addEventListener('click', closeHelpModal);

    // 5. Zavření draweru kliknutím do overlaye nebo klávesou Esc
    var overlay = document.getElementById('details-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeStationDetails);
    }
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (helpModal && helpModal.classList.contains('open')) {
          closeHelpModal();
        } else if (currentActiveStationId) {
          closeStationDetails();
        } else {
          closePrivacyModal();
        }
      }
    });

    // 6. Export a Import dat
    var btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        storage.exportJSON();
      });
    }

    var btnImport = document.getElementById('btn-import-data');
    var fileInput = document.getElementById('import-file-input');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', function () {
        var modal = document.getElementById('privacy-warning-modal');
        if (modal && modalBackdrop) {
          modal.classList.add('open');
          modalBackdrop.classList.add('open');
        } else {
          fileInput.click();
        }
      });

      var btnModalProceed = document.getElementById('btn-modal-import-proceed');
      if (btnModalProceed) {
        btnModalProceed.addEventListener('click', function () {
          closePrivacyModal();
          fileInput.click();
        });
      }

      var btnModalCancel = document.getElementById('btn-modal-import-cancel');
      if (btnModalCancel) {
        btnModalCancel.addEventListener('click', closePrivacyModal);
      }

      fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (evt) {
          var res = storage.importJSON(evt.target.result);
          if (res.success) {
            alert('Data úspěšně importována a sloučena (' + res.count + ' záznamů témat).');
            renderAllViews();
          } else {
            alert('Chyba při importu: ' + res.error);
          }
          fileInput.value = '';
        };
        reader.readAsText(file, 'utf-8');
      });
    }

    // 7. Reset dat (Smazat vše)
    var btnClear = document.getElementById('btn-clear-all-data');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        var ans = confirm('POZOR: Opravdu chcete smazat veškerá vaše uložená hodnocení a poznámky v tomto prohlížeči?\n\nPřed smazáním doporučujeme provést zálohu tlačítkem "Export progress.json".');
        if (ans) {
          storage.clearAll();
          alert('Data v prohlížeči byla vymazána.');
          renderAllViews();
        }
      });
    }
  }

  function closePrivacyModal() {
    var modal = document.getElementById('privacy-warning-modal');
    var modalBackdrop = document.getElementById('modal-backdrop');
    if (modal) modal.classList.remove('open');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : global);
