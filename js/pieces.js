/**
 * pieces.js
 * Renderiza as peças SVG locais de assets/pieces/ para cache eficiente no navegador
 * e compatibilidade estrita com a CSP (img-src 'self').
 */
(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const PIECE_KEYS = ['wP', 'bP', 'wR', 'bR', 'wN', 'bN', 'wB', 'bB', 'wQ', 'bQ', 'wK', 'bK'];

  const PIECES = {};
  PIECE_KEYS.forEach(function (key) {
    PIECES[key] =
      '<img class="piece-svg" src="assets/pieces/' +
      key.toLowerCase() +
      '.svg" alt="" draggable="false" decoding="async" />';
  });

  function getPieceSvg(fenChar) {
    if (!fenChar) return '';
    const isUpper = fenChar === fenChar.toUpperCase();
    const key = (isUpper ? 'w' : 'b') + fenChar.toUpperCase();
    return PIECES[key] || '';
  }

  ChessApp.pieces = {
    PIECES,
    getPieceSvg
  };
})(window);
