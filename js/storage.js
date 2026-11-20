/**
 * MAPA STUDENTSKÉHO POKROKU - SPRÁVCE ÚLOŽIŠTĚ (STORAGE)
 * Správa localStorage, verzování msp:v1:<pathname>, export/import a ochrana integrity dat.
 * Běží jako vanilla JS bez externích knihoven.
 */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 2;

  var STATUS_VALUES = ['not_started', 'working', 'done', 'help'];
  var SELF_ASSESSMENT_VALUES = ['none', 'certain', 'with_help', 'unclear'];
  var TRACK_VALUES = ['ALL', 'A', 'E', 'S'];
  var THEME_VALUES = ['minimal-light', 'minimal-dark', 'cyberpunk', 'scifi', 'steampunk'];
  var DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  var ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

  function sanitizeString(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.slice(0, maxLength);
  }

  function sanitizeStationRecord(rec) {
    if (!rec || typeof rec !== 'object') return null;
    var clean = {
      status: STATUS_VALUES.indexOf(rec.status) !== -1 ? rec.status : 'not_started',
      selfAssessment: SELF_ASSESSMENT_VALUES.indexOf(rec.selfAssessment) !== -1 ? rec.selfAssessment : 'none',
      nextStep: sanitizeString(rec.nextStep, 5000),
      notes: sanitizeString(rec.notes, 10000),
      completedAt: (typeof rec.completedAt === 'string' && DATE_REGEX.test(rec.completedAt)) ? rec.completedAt : null,
      updatedAt: (typeof rec.updatedAt === 'string' && ISO_DATETIME_REGEX.test(rec.updatedAt)) ? rec.updatedAt : new Date().toISOString(),
      tasks: {}
    };
    if (rec.tasks && typeof rec.tasks === 'object') {
      for (var tId in rec.tasks) {
        if (!Object.prototype.hasOwnProperty.call(rec.tasks, tId)) continue;
        var t = rec.tasks[tId];
        if (!t || typeof t !== 'object') continue;
        clean.tasks[tId] = {
          done: !!t.done,
          date: (typeof t.date === 'string' && DATE_REGEX.test(t.date)) ? t.date : '',
          grade: sanitizeString(t.grade, 24),
          comment: sanitizeString(t.comment, 10000)
        };
      }
    }
    return clean;
  }

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
      theme: 'minimal-light', // 'minimal-light' | 'minimal-dark' | 'cyberpunk' | 'scifi' | 'steampunk'
      activeView: 'map',
      stations: {}
    };
  }

  function getISODateToday() {
    var now = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Prague',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      return parts;
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
        if (!raw) return defaultState;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaultState;

        // Migrace schématu a starého quietMode
        if (!parsed.theme) {
          parsed.theme = parsed.quietMode ? 'minimal-dark' : 'minimal-light';
        }
        if (parsed.theme === 'scifi-rpg') {
          parsed.theme = 'scifi';
        }
        if (!parsed.stations) parsed.stations = {};
        // Odstranění zbytků extra.rocnikovy ze starších verzí
        if (parsed.extra) {
          delete parsed.extra;
        }

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
        console.error('[MSPStorage] Chyba při zápisu do localStorage:', err);
        return false;
      }
    },

    getStation: function (stationId) {
      var state = this.load();
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
      if (!state.stations[stationId]) {
        state.stations[stationId] = { tasks: {} };
      }
      var target = state.stations[stationId];

      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          target[k] = patch[k];
        }
      }
      target.updatedAt = new Date().toISOString();

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
      var station = state.stations[stationId];
      if (!station) {
        state.stations[stationId] = {
          status: 'not_started',
          selfAssessment: 'none',
          nextStep: '',
          notes: '',
          completedAt: null,
          updatedAt: new Date().toISOString(),
          tasks: {}
        };
        station = state.stations[stationId];
      }
      if (!station.tasks) station.tasks = {};
      if (!station.tasks[taskId]) {
        station.tasks[taskId] = {
          done: false,
          date: '',
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

        if (imported.stations && typeof imported.stations === 'object') {
          for (var id in imported.stations) {
            if (!Object.prototype.hasOwnProperty.call(imported.stations, id)) continue;
            var impSt = sanitizeStationRecord(imported.stations[id]);
            if (!impSt) continue;
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

        if (TRACK_VALUES.indexOf(imported.selectedTrack) !== -1) current.selectedTrack = imported.selectedTrack;
        if (TRACK_VALUES.indexOf(imported.manualCurrentStationId) === -1 && imported.manualCurrentStationId) {
          current.manualCurrentStationId = sanitizeString(imported.manualCurrentStationId, 64);
        }
        var importedTheme = imported.theme === 'scifi-rpg' ? 'scifi' : imported.theme;
        if (THEME_VALUES.indexOf(importedTheme) !== -1) {
          current.theme = importedTheme;
        }

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