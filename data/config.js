/**
 * KONFIGURACE APLIKACE - MAPA STUDENTSKÉHO POKROKU
 * Vyučující zde může upravit URL pro synchronizaci centrálních termínů.
 */
(function (root) {
  'use strict';

  var CONFIG = {
    // Výchozí URL adresa, ze které si studentská kopie stahuje aktuální termíny stanovené vyučujícím.
    // Pokud je student offline nebo otevírá aplikaci přes file://, použije se data/schedule.js.
    SCHEDULE_URL: 'https://vt002.github.io/MapaPokroku/data/schedule.json',

    // Časový limit pro stažení termínů (v milisekundách)
    FETCH_TIMEOUT_MS: 3500
  };

  root.APP_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : global);