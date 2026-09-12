(function (global) {
  'use strict';
  global.XoulApiBase = function () {
    const explicit = typeof global.XOUL_API_BASE === 'string' ? global.XOUL_API_BASE.trim() : '';
    if (explicit) return explicit.replace(/\/$/, '');
    const protocol = global.location?.protocol || '';
    if (protocol === 'http:' || protocol === 'https:') return String(global.location.origin || '').replace(/\/$/, '');
    return 'http://127.0.0.1:8780';
  };
})(window);
