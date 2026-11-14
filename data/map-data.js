/**
 * MAPA STUDENTSKÉHO POKROKU - STATICKÁ DATA MAPY
 * Zdroj pravdy pro stanice, trasy a úlohy.
 * Nepotřebuje server ani ES moduly, načítá se přes <script>.
 */
(function (root) {
  'use strict';

  var REPO_BASE = 'https://github.com/Vt002/';

  var MAP_DATA = {
    schemaVersion: 1,
    repoBaseUrl: REPO_BASE,
    tracks: {
      A: {
        id: 'A',
        name: 'Obor A (Aplikovaná informatika / Automatizace)',
        shortName: 'A',
        color: '#00E5FF', // azurová
        lineStyle: 'solid',
        stations: [
          'vyber',
          'dio-mcu',
          'iot',
          'vyvojove',
          'plc',
          'dio-plc',
          'senzory',
          'regulace'
        ]
      },
      E: {
        id: 'E',
        name: 'Obor E (Elektrotechnika)',
        shortName: 'E',
        color: '#FF3DCB', // purpurová
        lineStyle: 'dotted',
        stations: [
          'vyber',
          'plc',
          'dio-plc',
          'senzory',
          'regulace',
          'bezpecnost'
        ]
      },
      S: {
        id: 'S',
        name: 'Obor S (Strojírenství / Mechatronika)',
        shortName: 'S',
        color: '#FCEE09', // kyselá žlutá
        lineStyle: 'dashed',
        stations: [
          'vyber',
          'plc',
          'dio-plc',
          'senzory',
          'regulace',
          'bezpecnost'
        ]
      }
    },
    stations: {
      'vyber': {
        id: 'vyber',
        title: 'Výběr řídící jednotky pro různé aplikace',
        repo: 'Vyber-ridici-jednotky-pro-ruzne-aplikace',
        subpath: '',
        trackNumbers: { A: 'A1', E: 'E9', S: 'S' },
        tags: ['S3', 'E3', 'T3A'],
        tasks: [
          { id: '1', title: '1 Základní pojmy a architektury řídicích jednotek', challenge: false },
          { id: '2', title: '2 Parametry, paměti a provozní odolnost (IP krytí)', challenge: false },
          { id: '3', title: '3 Rozhodovací matice platforem (MCU vs. PLC vs. iPC)', challenge: false },
          { id: '4', title: '4 Návrh a konfigurace řídicí jednotky pro čerpací stanici', challenge: false },
          { id: '5', title: '5 Technický audit a oponentura nevhodného návrhu', challenge: false },
          { id: '6', title: '6* Rozšiřující inženýrská výzva: TCO a životní cyklus v automatizaci', challenge: true }
        ]
      },
      'dio-mcu': {
        id: 'dio-mcu',
        title: 'Práce s digitálními vstupy a výstupy a řízení (ovládání) na základě času → MCU',
        repo: 'Prace-s-digitalnimi-vstupy-a-vystupy-a-rizeni-na-z-klade-casu',
        subpath: 'MCU',
        trackNumbers: { A: 'A3' },
        tags: ['S3', 'E3', 'T3A', 'T4A'],
        tasks: [
          { id: '1', title: '1 Klíčové pojmy a principy číslicových I/O periferií', challenge: false },
          { id: '2', title: '2 Dimenzování předřadného rezistoru LED a elektrické zapojení I/O', challenge: false }
        ]
      },
      'iot': {
        id: 'iot',
        title: 'Návrh a realizace jednoduchého zařízení pro IoT',
        repo: 'Navrh-a-realizace-jednoducheho-zarizeni-pro-IoT',
        subpath: '',
        trackNumbers: { A: 'A2' },
        tags: ['T3A'],
        tasks: [
          { id: '1', title: '1 Co je to IoT', challenge: false },
          { id: '2', title: '2 Komunikace MCU s okolím', challenge: false },
          { id: '3', title: '3 IoT lampička', challenge: false },
          { id: '4', title: '4 IoT senzor teploty (příp. i vlhkosti)', challenge: false }
        ]
      },
      'vyvojove': {
        id: 'vyvojove',
        title: 'Vývojové prostředky',
        repo: 'Vyvojove-prostredky',
        subpath: '',
        trackNumbers: { A: 'A4' },
        tags: [],
        tasks: [
          { id: '1', title: '1 Ahoj světe', challenge: false },
          { id: '2', title: '2 Struktura programu', challenge: false },
          { id: '3', title: '3 Hardwarové vývojové prostředky', challenge: false },
          { id: '4', title: '4 Softwarové vývojové prostředky a programovací jazyky', challenge: false }
        ]
      },
      'plc': {
        id: 'plc',
        title: 'Programovatelné automaty (PLC)',
        repo: 'Programovateln--automaty--PLC-',
        subpath: '',
        trackNumbers: { A: 'A5', E: 'E10', S: 'S21' },
        tags: ['S3', 'E3', 'T4A'],
        tasks: [
          { id: '1', title: '1 Základní vlastnosti a rozdělení PLC', challenge: false },
          { id: '2', title: '2 Části PLC, paměti, procesní obraz a provozní vlastnosti', challenge: false },
          { id: '3', title: '3 Inženýrská konfigurace funkční sestavy PLC Teco a proudová bilance', challenge: false },
          { id: '4', title: '4 Provozní diagnostika PLC, měření multimetrem a troubleshooting v IDE Mosaic', challenge: false },
          { id: '5', title: '5 Simulace řídicího programu v prostředí Teco Mosaic: od teorie k praxi', challenge: false },
          { id: '6', title: '6* Rozšiřující inženýrská výzva: TCO, životní cyklus PLC Teco a funkční bezpečnost', challenge: true }
        ]
      },
      'dio-plc': {
        id: 'dio-plc',
        title: 'Práce s digitálními vstupy a výstupy a řízení (ovládání) na základě času → PLC',
        repo: 'Prace-s-digitalnimi-vstupy-a-vystupy-a-rizeni-na-z-klade-casu',
        subpath: 'PLC',
        trackNumbers: { A: 'A', E: 'E11', S: 'S22' },
        tags: ['S3', 'E3', 'T3A', 'T4A'],
        tasks: [
          { id: '1', title: '1 Klíčové pojmy a principy číslicových I/O periferií', challenge: false },
          { id: '2', title: '2 Dimenzování předřadného rezistoru LED a elektrické zapojení I/O', challenge: false }
        ]
      },
      'senzory': {
        id: 'senzory',
        title: 'Řízení (ovládání) pomocí senzorů',
        repo: 'Rizeni-pomoci-senzoru',
        subpath: '',
        trackNumbers: { A: 'A6', E: 'E12', S: 'S23' },
        tags: ['S3E'],
        tasks: [
          { id: '1', title: '1 Základní vlastnosti senzorů', challenge: false },
          { id: '2', title: '2 Ověření funkčnosti senzorů', challenge: false },
          { id: '3', title: '3 Zapojení vybraných senzorů k PLC', challenge: false }
        ]
      },
      'regulace': {
        id: 'regulace',
        title: 'Regulace',
        repo: 'Regulace',
        subpath: '',
        trackNumbers: { A: 'A7', E: 'E13', S: 'S24' },
        tags: ['S3E'],
        tasks: [
          { id: '1', title: '1 Jaký je rozdíl mezi ovládáním a regulací', challenge: false },
          { id: '2', title: '2 Navrhněte a realizujte dvoustavový regulátor', challenge: false },
          { id: '3', title: '3 Navrhněte a realizujte PID regulátor', challenge: false }
        ]
      },
      'bezpecnost': {
        id: 'bezpecnost',
        title: 'Bezpečnost a diagnostika řídících jednotek',
        repo: 'Bezpecnost-a-diagnostika-ridicich-jednotek',
        subpath: '',
        trackNumbers: { E: 'E14', S: 'S25' },
        tags: ['S4E'],
        tasks: [
          { id: '1', title: '1 Safety', challenge: false },
          { id: '2', title: '2 Security', challenge: false },
          { id: '3', title: '3 Diagnostika řídící jednotky', challenge: false }
        ]
      }
    }
  };

  root.MAP_DATA = MAP_DATA;
})(typeof window !== 'undefined' ? window : global);
