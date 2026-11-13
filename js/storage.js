/**
 * MAPA STUDENTSKÉHO POKROKU - SPRÁVCE ÚLOŽIŠTĚ (STORAGE)
 * Správa localStorage, verzování msp:v1:<pathname>, export/import a ochrana integrity dat.
 * Běží jako vanilla JS bez externích knihoven.
 */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;

  function getStorageKey() {
    var path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '/';
    return 'msp:v1:' + path;
  }

  function createDefaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      selectedTrack: 'ALL',
      manualCurrentStationId: null,
      quietMode: false,
      activeView: 'map',
      stations: {},
      extra: {
        rocnikovy: {
          status: 'not_started',
          selfAssessment: 'none',
          nextStep: '',
          notes: '',
          completedAt: null,
          updatedAt: new Date().toISOString(),
          tasks: {
            '1': { done: false, date: '', level: 0, grade: '', comment: '' },
            '2': { done: false, date: '', level: 0, grade: '', comment: '' }
          }
        }
      }
    };
  }

  function getISODateToday() {
    // Časové pásmo Europe/Prague
    var now = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Prague',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      return parts; // Vrací 'YYYY-MM-DD'
    } catch (e) {
      return now.toISOString().slice(0, 10);
    }
  }

  var MSPStorage = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    getISODateToday: getISODateToday,

    load: function () {
      var key = getStorageKey();
      var defaultState = createDefaultState();
      try {
        var raw = localStorage.getItem(key);
        if (!raw) {
          return defaultState;
        }
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          return defaultState;
        }
        // Migrace schématu
        if (!parsed.schemaVersion || parsed.schemaVersion < SCHEMA_VERSION) {
          parsed.schemaVersion = SCHEMA_VERSION;
        }
        if (!parsed.stations) parsed.stations = {};
        if (!parsed.extra) parsed.extra = defaultState.extra;
        return parsed;
      } catch (err) {
        console.warn('[MSPStorage] Chyba při načítání z localStorage:', err);
        return defaultState;
      }
    },

    save: function (state) {
      var key = getStorageKey();
      try {
        if (!state || typeof state !== 'object') return false;
        state.schemaVersion = SCHEMA_VERSION;
        localStorage.setItem(key, JSON.stringify(state));
        return true;
      } catch (err) {
        console.error('[MSPStorage] Chyba při zápisu do localStorage (kvóta překročena?):', err);
        return false;
      }
    },

    getStation: function (stationId) {
      var state = this.load();
      if (stationId === 'rocnikovy') {
        if (!state.extra) state.extra = {};
        if (!state.extra.rocnikovy) {
          state.extra.rocnikovy = {
            status: 'not_started',
            selfAssessment: 'none',
            nextStep: '',
            notes: '',
            completedAt: null,
            updatedAt: new Date().toISOString(),
            tasks: {}
          };
        }
        return state.extra.rocnikovy;
      }

      if (!state.stations[stationId]) {
        state.stations[stationId] = {
          status: 'not_started',
          selfAssessment: 'none',
          nextStep: '',
          notes: '',
          completedAt: null,
          updatedAt: new Date().toISOString(),
          tasks: {}
        };
      }
      return state.stations[stationId];
    },

    updateStation: function (stationId, patch) {
      var state = this.load();
      var target = null;
      if (stationId === 'rocnikovy') {
        if (!state.extra) state.extra = {};
        if (!state.extra.rocnikovy) state.extra.rocnikovy = {};
        target = state.extra.rocnikovy;
      } else {
        if (!state.stations[stationId]) {
          state.stations[stationId] = { tasks: {} };
        }
        target = state.stations[stationId];
      }

      // Provedení změn
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          target[k] = patch[k];
        }
      }
      target.updatedAt = new Date().toISOString();

      // Pokud student přepnul stav na "done" (Zvládám) a nemá datum, nastavíme dnešek
      if (patch.status === 'done' && !target.completedAt) {
        target.completedAt = getISODateToday();
      } else if (patch.status && patch.status !== 'done') {
        target.completedAt = null;
      }

      this.save(state);
      return target;
    },

    updateTask: function (stationId, taskId, taskPatch) {
      var state = this.load();
      var station = (stationId === 'rocnikovy') ? (state.extra && state.extra.rocnikovy) : state.stations[stationId];
      if (!station) {
        this.getStation(stationId); // Inicializuje
        state = this.load();
        station = (stationId === 'rocnikovy') ? state.extra.rocnikovy : state.stations[stationId];
      }
      if (!station.tasks) station.tasks = {};
      if (!station.tasks[taskId]) {
        station.tasks[taskId] = {
          done: false,
          date: '',
          level: 0,
          grade: '',
          comment: ''
        };
      }
      for (var prop in taskPatch) {
        if (Object.prototype.hasOwnProperty.call(taskPatch, prop)) {
          station.tasks[taskId][prop] = taskPatch[prop];
        }
      }
      station.updatedAt = new Date().toISOString();
      this.save(state);
      return station.tasks[taskId];
    },

    addCustomTask: function (stationId, taskTitle) {
      var cleanTitle = (taskTitle || '').trim();
      if (!cleanTitle) return null;
      var taskId = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var state = this.load();
      var station = (stationId === 'rocnikovy') ? state.extra.rocnikovy : state.stations[stationId];
      if (!station) {
        this.getStation(stationId);
        state = this.load();
        station = (stationId === 'rocnikovy') ? state.extra.rocnikovy : state.stations[stationId];
      }
      if (!station.tasks) station.tasks = {};
      station.tasks[taskId] = {
        id: taskId,
        title: cleanTitle,
        isCustom: true,
        done: false,
        date: getISODateToday(),
        level: 0,
        grade: '',
        comment: ''
      };
      station.updatedAt = new Date().toISOString();
      this.save(state);
      return station.tasks[taskId];
    },

    removeCustomTask: function (stationId, taskId) {
      var state = this.load();
      var station = (stationId === 'rocnikovy') ? (state.extra && state.extra.rocnikovy) : state.stations[stationId];
      if (station && station.tasks && station.tasks[taskId]) {
        delete station.tasks[taskId];
        station.updatedAt = new Date().toISOString();
        this.save(state);
        return true;
      }
      return false;
    },

    exportJSON: function () {
      var state = this.load();
      state.exportedAt = new Date().toISOString();
      var jsonStr = JSON.stringify(state, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'progress.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    importJSON: function (jsonContent) {
      try {
        var imported = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
        if (!imported || typeof imported !== 'object') {
          throw new Error('Neplatný formát souboru (není JSON objekt).');
        }
        var current = this.load();
        
        // Záchrana a sloučení podle updatedAt pro každou stanici
        if (imported.stations && typeof imported.stations === 'object') {
          for (var id in imported.stations) {
            if (!Object.prototype.hasOwnProperty.call(imported.stations, id)) continue;
            var impSt = imported.stations[id];
            var curSt = current.stations[id];
            if (!curSt) {
              current.stations[id] = impSt;
            } else {
              var curTime = new Date(curSt.updatedAt || 0).getTime();
              var impTime = new Date(impSt.updatedAt || 0).getTime();
              if (impTime >= curTime) {
                current.stations[id] = impSt;
              }
            }
          }
        }

        // Sloučení extra sekce
        if (imported.extra && imported.extra.rocnikovy) {
          var curR = current.extra && current.extra.rocnikovy;
          var impR = imported.extra.rocnikovy;
          if (!curR) {
            current.extra.rocnikovy = impR;
          } else {
            var cTime = new Date(curR.updatedAt || 0).getTime();
            var iTime = new Date(impR.updatedAt || 0).getTime();
            if (iTime >= cTime) {
              current.extra.rocnikovy = impR;
            }
          }
        }

        if (imported.selectedTrack) current.selectedTrack = imported.selectedTrack;
        if (imported.manualCurrentStationId) current.manualCurrentStationId = imported.manualCurrentStationId;
        if (typeof imported.quietMode === 'boolean') current.quietMode = imported.quietMode;

        this.save(current);
        return { success: true, count: Object.keys(imported.stations || {}).length };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    clearAll: function () {
      var key = getStorageKey();
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  root.MSPStorage = MSPStorage;
})(typeof window !== 'undefined' ? window : global);

