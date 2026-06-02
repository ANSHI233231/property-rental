/* ============================================================================
 * rent-settings.js — single source for the tunable rent rules edited on the
 * admin Settings page and consumed by rent-engine.js. The late-fee rate and
 * grace period live HERE (mirrored from Settings), so changing them on the
 * Settings page changes every rent calculation across the app.
 *
 * Persisted to localStorage so a change saved on Settings is reflected on the
 * Rent / Record-Payment pages within the same browser (prototype stand-in for
 * the backend Settings table). Falls back to the defaults if nothing saved.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DEFAULTS = { lateFeeRatePercent: 2, graceDays: 5 };
  var stored = {};
  try { stored = JSON.parse(global.localStorage.getItem('gharsetu_rent_settings') || '{}'); } catch (e) { stored = {}; }

  global.GHARSETU_RENT_SETTINGS = {
    lateFeeRatePercent: stored.lateFeeRatePercent != null ? Number(stored.lateFeeRatePercent) : DEFAULTS.lateFeeRatePercent,
    graceDays:          stored.graceDays          != null ? Number(stored.graceDays)          : DEFAULTS.graceDays
  };

  // Called by the Settings page on save → updates the live object + persists.
  global.gsSaveRentSettings = function (ratePercent, graceDays) {
    global.GHARSETU_RENT_SETTINGS.lateFeeRatePercent = Number(ratePercent);
    global.GHARSETU_RENT_SETTINGS.graceDays = Number(graceDays);
    try { global.localStorage.setItem('gharsetu_rent_settings', JSON.stringify(global.GHARSETU_RENT_SETTINGS)); } catch (e) {}
  };
})(typeof window !== 'undefined' ? window : this);
