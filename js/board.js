(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  function parseFenBoard(fen) {
    const placement = (fen || '').split(' ')[0] || '8/8/8/8/8/8/8/8';
    const rows = placement.split('/');
    const board = [];
    for (let r = 0; r < 8; r += 1) {
      const rowStr = rows[r] || '8';
      const row = [];
      for (let i = 0; i < rowStr.length; i += 1) {
        const ch = rowStr[i];
        const digit = Number(ch);
        if (digit >= 1 && digit <= 8) {
          for (let k = 0; k < digit; k += 1) row.push(null);
        } else {
          row.push(ch);
        }
      }
      while (row.length < 8) row.push(null);
      board.push(row);
    }
    return board;
  }

  function squareToCenter(square, orientation) {
    if (!square || square.length < 2) return null;
    const fileIdx = FILES.indexOf(square[0].toLowerCase());
    const rankNum = Number(square[1]);
    if (fileIdx < 0 || rankNum < 1 || rankNum > 8) return null;

    const col = orientation === 'black' ? 7 - fileIdx : fileIdx;
    const row = orientation === 'black' ? rankNum - 1 : 8 - rankNum;
    return {
      x: col * 100 + 50,
      y: row * 100 + 50
    };
  }

  function renderArrows(svgEl, arrows, orientation) {
    if (!svgEl) return;
    if (!arrows || arrows.length === 0) {
      svgEl.innerHTML = '';
      return;
    }

    let defs = '<defs>';
    const uniqueColors = [];
    arrows.forEach(function (arrow, idx) {
      const color = arrow.color || '#22c55e';
      const markerId = 'arrowhead-' + idx;
      uniqueColors.push({ markerId, color });
      defs +=
        '<marker id="' +
        markerId +
        '" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">' +
        '<polygon points="0 0.4, 3.6 2, 0 3.6" fill="' +
        color +
        '" />' +
        '</marker>';
    });
    defs += '</defs>';

    let lines = '';
    arrows.forEach(function (arrow, idx) {
      const start = squareToCenter(arrow.from, orientation);
      const end = squareToCenter(arrow.to, orientation);
      if (!start || !end) return;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return;

      const startOffset = 14;
      const endOffset = 22;
      const ux = dx / dist;
      const uy = dy / dist;

      const x1 = start.x + ux * startOffset;
      const y1 = start.y + uy * startOffset;
      const x2 = end.x - ux * endOffset;
      const y2 = end.y - uy * endOffset;

      const color = arrow.color || '#22c55e';
      lines +=
        '<line x1="' +
        x1.toFixed(1) +
        '" y1="' +
        y1.toFixed(1) +
        '" x2="' +
        x2.toFixed(1) +
        '" y2="' +
        y2.toFixed(1) +
        '" stroke="' +
        color +
        '" stroke-width="15" stroke-linecap="round" stroke-opacity="0.88" marker-end="url(#arrowhead-' +
        idx +
        ')" />';
    });

    svgEl.innerHTML = defs + lines;
  }

  function renderBoard(boardEl, arrowsEl, fen, orientation, lastMove, arrows) {
    if (!boardEl) return;
    const grid = parseFenBoard(fen);
    const isBlackView = orientation === 'black';
    const frag = document.createDocumentFragment();

    for (let visualRow = 0; visualRow < 8; visualRow += 1) {
      for (let visualCol = 0; visualCol < 8; visualCol += 1) {
        const boardRow = isBlackView ? 7 - visualRow : visualRow;
        const boardCol = isBlackView ? 7 - visualCol : visualCol;

        const fileChar = FILES[boardCol];
        const rankChar = String(8 - boardRow);
        const sqName = fileChar + rankChar;
        const isLight = (boardRow + boardCol) % 2 === 0;

        const sqDiv = document.createElement('div');
        sqDiv.className = 'square ' + (isLight ? 'light' : 'dark');
        sqDiv.dataset.square = sqName;

        if (lastMove && (lastMove.from === sqName || lastMove.to === sqName)) {
          sqDiv.classList.add('last-move');
        }

        if (visualCol === 0) {
          const rankSpan = document.createElement('span');
          rankSpan.className = 'coord-rank';
          rankSpan.textContent = rankChar;
          sqDiv.appendChild(rankSpan);
        }

        if (visualRow === 7) {
          const fileSpan = document.createElement('span');
          fileSpan.className = 'coord-file';
          fileSpan.textContent = fileChar;
          sqDiv.appendChild(fileSpan);
        }

        const pieceChar = grid[boardRow][boardCol];
        if (pieceChar) {
          sqDiv.insertAdjacentHTML('beforeend', ChessApp.pieces.getPieceSvg(pieceChar));
        }

        frag.appendChild(sqDiv);
      }
    }

    boardEl.innerHTML = '';
    boardEl.appendChild(frag);
    renderArrows(arrowsEl, arrows, orientation);
  }

  function winProbabilityWhite(evalObj) {
    if (!evalObj) return 50;
    if (evalObj.type === 'mate') {
      return evalObj.value > 0 ? 100 : 0;
    }
    const cp = Math.max(-2000, Math.min(2000, evalObj.value || 0));
    return 50 + 50 * (2 / (1 + Math.exp(-0.004 * cp)) - 1);
  }

  function formatEvalScore(evalObj) {
    if (!evalObj) return '0.0';
    if (evalObj.type === 'mate') {
      if (evalObj.terminal) {
        return evalObj.value > 0 ? '1-0' : '0-1';
      }
      const sign = evalObj.value > 0 ? '+' : '-';
      return sign + 'M' + Math.abs(evalObj.value);
    }
    const pawns = (evalObj.value || 0) / 100;
    const absVal = Math.abs(pawns);
    const formatted = absVal >= 10 ? absVal.toFixed(0) : absVal.toFixed(1);
    if (Math.abs(pawns) < 0.05) return '0.0';
    return (pawns > 0 ? '+' : '-') + formatted;
  }

  function updateEvalBar(barEl, fillEl, labelEl, evalObj, orientation) {
    if (!barEl || !fillEl || !labelEl) return;

    const isFlipped = orientation === 'black';
    barEl.classList.toggle('flipped', isFlipped);

    let whitePct = winProbabilityWhite(evalObj);
    if (evalObj && evalObj.type === 'mate') {
      whitePct = evalObj.value > 0 ? 100 : 0;
    } else {
      whitePct = Math.max(4, Math.min(96, whitePct));
    }

    fillEl.style.height = whitePct.toFixed(1) + '%';
    labelEl.textContent = formatEvalScore(evalObj);

    const whiteAdvantage = !evalObj || evalObj.value >= 0;
    labelEl.classList.remove('eval-label-top', 'eval-label-bottom');

    if (whiteAdvantage) {
      labelEl.classList.add(isFlipped ? 'eval-label-top' : 'eval-label-bottom');
      labelEl.style.color = '#1e1e1c';
    } else {
      labelEl.classList.add(isFlipped ? 'eval-label-bottom' : 'eval-label-top');
      labelEl.style.color = '#f3f3ee';
    }
  }

  ChessApp.board = {
    renderBoard,
    updateEvalBar,
    winProbabilityWhite,
    formatEvalScore
  };
})(window);
