(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const FAST_DEPTH = 10;
  const DEEP_DEPTH = 15;
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const CHESSCOM_USER_STORAGE_KEY = 'xadrez_analise_chesscom_user';

  const UP_ARROW_SVG =
    '<svg class="btn-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>';

  const state = {
    gameId: '',
    headers: {},
    positions: [],
    currentPly: 0,
    orientation: 'white',
    evals: [],
    bestMoves: [],
    allReviews: [],
    reviewsByPly: {},
    reviewColor: 'w',
    reviewFilter: 'all',
    badgeMap: {},
    explanations: {},
    loadingExplainPly: {},
    explainErrors: {},
    collapsedExplainPly: {},
    analysisDepth: null,
    isAnalyzing: false,
    recentGames: [],
    activeRecentGameId: null,
    searchRequestId: 0,
    chatMessages: [],
    chatRequestId: 0,
    chatBusy: false,
    chatStatus: '',
    chatArrow: null
  };

  const els = {};

  function cacheDom() {
    els.tabBtnChesscom = document.getElementById('tab-btn-chesscom');
    els.tabBtnPgn = document.getElementById('tab-btn-pgn');
    els.tabPanelChesscom = document.getElementById('tab-panel-chesscom');
    els.tabPanelPgn = document.getElementById('tab-panel-pgn');
    els.chesscomForm = document.getElementById('chesscom-form');
    els.chesscomUsername = document.getElementById('chesscom-username');
    els.btnFetchChesscom = document.getElementById('btn-fetch-chesscom');
    els.pgnInput = document.getElementById('pgn-input');
    els.btnLoadPgn = document.getElementById('btn-load-pgn');
    els.loaderFeedback = document.getElementById('loader-feedback');

    els.playerTopColor = document.getElementById('player-top-color');
    els.playerTopName = document.getElementById('player-top-name');
    els.playerTopRating = document.getElementById('player-top-rating');
    els.playerBottomColor = document.getElementById('player-bottom-color');
    els.playerBottomName = document.getElementById('player-bottom-name');
    els.playerBottomRating = document.getElementById('player-bottom-rating');

    els.evalBar = document.getElementById('eval-bar');
    els.evalBarFill = document.getElementById('eval-bar-fill');
    els.evalScoreLabel = document.getElementById('eval-score-label');
    els.chessboard = document.getElementById('chessboard');
    els.boardArrows = document.getElementById('board-arrows');
    els.arrowLegend = document.getElementById('arrow-legend');
    els.legendRedItem = document.getElementById('legend-red-item');
    els.legendGreenItem = document.getElementById('legend-green-item');
    els.legendBlueItem = document.getElementById('legend-blue-item');

    els.btnFirst = document.getElementById('btn-first');
    els.btnPrev = document.getElementById('btn-prev');
    els.btnNext = document.getElementById('btn-next');
    els.btnLast = document.getElementById('btn-last');
    els.btnFlip = document.getElementById('btn-flip');

    els.analysisStatusText = document.getElementById('analysis-status-text');
    els.analysisProgressBar = document.getElementById('analysis-progress-bar');
    els.btnDeepAnalysis = document.getElementById('btn-deep-analysis');
    els.reviewPanelTitle = document.getElementById('review-panel-title');
    els.btnReviewWhite = document.getElementById('btn-review-white');
    els.btnReviewBlack = document.getElementById('btn-review-black');
    els.reviewSummary = document.getElementById('review-summary');
    els.reviewAccuracyPill = document.getElementById('review-accuracy-pill');
    els.reviewCountsText = document.getElementById('review-counts-text');
    els.reviewControls = document.getElementById('review-controls');
    els.btnFilterAll = document.getElementById('btn-filter-all');
    els.btnFilterErrors = document.getElementById('btn-filter-errors');
    els.btnReviewPrev = document.getElementById('btn-review-prev');
    els.reviewPositionCounter = document.getElementById('review-position-counter');
    els.btnReviewNext = document.getElementById('btn-review-next');
    els.reviewCurrentCard = document.getElementById('review-current-card');
    els.reviewMovesList = document.getElementById('review-moves-list');
    els.gameResultBadge = document.getElementById('game-result-badge');
    els.movesList = document.getElementById('moves-list');

    els.chatContextBadge = document.getElementById('chat-context-badge');
    els.btnClearChat = document.getElementById('btn-clear-chat');
    els.chatMessages = document.getElementById('chat-messages');
    els.chatForm = document.getElementById('chat-form');
    els.chatInput = document.getElementById('chat-input');
    els.btnChatSend = document.getElementById('btn-chat-send');

    els.recentGamesSection = document.getElementById('recent-games-section');
    els.recentGamesTitle = document.getElementById('recent-games-title');
    els.recentGamesList = document.getElementById('recent-games-list');

    els.btnOpenSettings = document.getElementById('btn-open-settings');
    els.btnOpenTutorial = document.getElementById('btn-open-tutorial');
    els.aiSettingsLabel = document.getElementById('ai-settings-label');
    els.aiStatusBadge = document.getElementById('ai-status-badge');

    els.settingsModal = document.getElementById('settings-modal');
    els.settingsNotice = document.getElementById('settings-notice');
    els.aiProviderSelect = document.getElementById('ai-provider-select');
    els.aiModelSelect = document.getElementById('ai-model-select');
    els.btnRefreshModels = document.getElementById('btn-refresh-models');
    els.aiApiKeyInput = document.getElementById('ai-api-key-input');
    els.btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
    els.btnSaveSettings = document.getElementById('btn-save-settings');
    els.btnClearSettings = document.getElementById('btn-clear-settings');
    els.btnOpenTutorialFromSettings = document.getElementById('btn-open-tutorial-from-settings');

    els.tutorialModal = document.getElementById('tutorial-modal');
    els.btnGoSettingsFromTutorial = document.getElementById('btn-go-settings-from-tutorial');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatAiTextSafe(rawText) {
    const escaped = escapeHtml(rawText);
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map(function (block) {
        const trimmed = block.trim();
        if (!trimmed) return '';
        const withBold = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return '<p>' + withBold.replace(/\n/g, '<br>') + '</p>';
      })
      .filter(Boolean);
    return paragraphs.join('') || '<p>' + escaped + '</p>';
  }

  function showLoaderFeedback(message, type) {
    if (!message) {
      els.loaderFeedback.className = 'loader-feedback hidden';
      els.loaderFeedback.textContent = '';
      return;
    }
    els.loaderFeedback.textContent = message;
    els.loaderFeedback.className = 'loader-feedback ' + (type || '');
  }

  function switchInputTab(tabName) {
    const isChessCom = tabName === 'chesscom';
    els.tabBtnChesscom.classList.toggle('active', isChessCom);
    els.tabBtnChesscom.setAttribute('aria-selected', String(isChessCom));
    els.tabPanelChesscom.classList.toggle('hidden', !isChessCom);
    els.tabPanelChesscom.classList.toggle('active', isChessCom);

    els.tabBtnPgn.classList.toggle('active', !isChessCom);
    els.tabBtnPgn.setAttribute('aria-selected', String(!isChessCom));
    els.tabPanelPgn.classList.toggle('hidden', isChessCom);
    els.tabPanelPgn.classList.toggle('active', !isChessCom);
  }

  function sanitizeComplexPgn(pgnText) {
    const lines = String(pgnText || '').split(/\r?\n/);
    const headerLines = [];
    const moveLines = [];
    lines.forEach(function (line) {
      if (/^\s*\[.*\]\s*$/.test(line)) {
        headerLines.push(line.trim());
      } else {
        moveLines.push(line);
      }
    });

    let movetext = moveLines.join(' ');
    movetext = movetext.replace(/\{[^}]*\}/g, ' ');
    movetext = movetext.replace(/;[^\r\n]*/g, ' ');
    let prev;
    do {
      prev = movetext;
      movetext = movetext.replace(/\([^()]*\)/g, ' ');
    } while (movetext !== prev);
    movetext = movetext.replace(/\$\d+/g, ' ').replace(/\s+/g, ' ').trim();

    if (headerLines.length > 0) {
      return headerLines.join('\n') + '\n\n' + movetext;
    }
    return movetext;
  }

  function parsePgnToPositions(pgnText) {
    if (typeof global.Chess !== 'function') {
      throw new Error('Biblioteca Chess.js não foi carregada.');
    }

    const chess = new global.Chess();
    let ok = chess.load_pgn(pgnText.trim(), { sloppy: true });
    if (!ok) {
      const cleaned = sanitizeComplexPgn(pgnText);
      ok = chess.load_pgn(cleaned, { sloppy: true });
    }
    if (!ok) {
      throw new Error('Não foi possível ler esse PGN. Confira se os lances estão completos.');
    }

    const headers = chess.header();
    const verboseHistory = chess.history({ verbose: true });
    if (!verboseHistory || verboseHistory.length === 0) {
      throw new Error('Essa partida não contém nenhum lance válido.');
    }

    while (chess.undo()) {
      // rewind to exact initial FEN
    }
    const startFen = chess.fen();
    const replay = new global.Chess(startFen);

    const positions = [
      {
        ply: 0,
        fen: startFen,
        turn: replay.turn(),
        san: null,
        uci: null,
        from: null,
        to: null,
        moveNumber: 0,
        color: null
      }
    ];

    verboseHistory.forEach(function (mv, idx) {
      const ply = idx + 1;
      const moveNumber = Math.floor(idx / 2) + 1;
      const moverColor = replay.turn();
      const applied = replay.move(mv.san, { sloppy: true });
      if (!applied) return;

      positions.push({
        ply: ply,
        fen: replay.fen(),
        turn: replay.turn(),
        san: applied.san,
        uci: applied.from + applied.to + (applied.promotion || ''),
        from: applied.from,
        to: applied.to,
        moveNumber: moveNumber,
        color: moverColor
      });
    });

    return { headers: headers, positions: positions };
  }

  function updatePlayerBars() {
    const h = state.headers || {};
    const whiteName = h.White || 'Brancas';
    const blackName = h.Black || 'Pretas';
    const whiteElo = h.WhiteElo ? '(' + h.WhiteElo + ')' : '';
    const blackElo = h.BlackElo ? '(' + h.BlackElo + ')' : '';

    if (state.orientation === 'white') {
      els.playerTopColor.className = 'color-dot color-black';
      els.playerTopName.textContent = blackName;
      els.playerTopRating.textContent = blackElo;

      els.playerBottomColor.className = 'color-dot color-white';
      els.playerBottomName.textContent = whiteName;
      els.playerBottomRating.textContent = whiteElo;
    } else {
      els.playerTopColor.className = 'color-dot color-white';
      els.playerTopName.textContent = whiteName;
      els.playerTopRating.textContent = whiteElo;

      els.playerBottomColor.className = 'color-dot color-black';
      els.playerBottomName.textContent = blackName;
      els.playerBottomRating.textContent = blackElo;
    }
  }

  function updateArrowLegend(hasRed, hasGreen, hasBlue) {
    els.legendRedItem.classList.toggle('hidden', !hasRed);
    els.legendGreenItem.classList.toggle('hidden', !hasGreen);
    els.legendBlueItem.classList.toggle('hidden', !hasBlue);
    els.arrowLegend.classList.toggle('hidden', !hasRed && !hasGreen && !hasBlue);
  }

  function renderCurrentPosition() {
    const arrows = [];
    let hasRed = false;
    let hasGreen = false;
    let hasBlue = false;

    if (state.positions.length === 0) {
      if (state.chatArrow && state.chatArrow.from && state.chatArrow.to) {
        arrows.push({ from: state.chatArrow.from, to: state.chatArrow.to, color: '#38bdf8' });
        hasBlue = true;
      }
      ChessApp.board.renderBoard(
        els.chessboard,
        els.boardArrows,
        START_FEN,
        state.orientation,
        null,
        arrows
      );
      ChessApp.board.updateEvalBar(
        els.evalBar,
        els.evalBarFill,
        els.evalScoreLabel,
        { type: 'cp', value: 0 },
        state.orientation
      );
      updateArrowLegend(false, false, hasBlue);
      updateNavButtons();
      return;
    }

    const pos = state.positions[state.currentPly];
    const lastMove = pos.from && pos.to ? { from: pos.from, to: pos.to } : null;

    const review = state.reviewsByPly[state.currentPly];
    if (review && review.isMistake) {
      if (review.playedFrom && review.playedTo) {
        arrows.push({ from: review.playedFrom, to: review.playedTo, color: '#ef4444' });
        hasRed = true;
      }
      if (review.bestFrom && review.bestTo) {
        arrows.push({ from: review.bestFrom, to: review.bestTo, color: '#22c55e' });
        hasGreen = true;
      }
    }

    if (state.chatArrow && state.chatArrow.from && state.chatArrow.to) {
      arrows.push({ from: state.chatArrow.from, to: state.chatArrow.to, color: '#38bdf8' });
      hasBlue = true;
    }

    updateArrowLegend(hasRed, hasGreen, hasBlue);

    ChessApp.board.renderBoard(
      els.chessboard,
      els.boardArrows,
      pos.fen,
      state.orientation,
      lastMove,
      arrows
    );

    const currentEval = state.evals[state.currentPly] || { type: 'cp', value: 0 };
    ChessApp.board.updateEvalBar(
      els.evalBar,
      els.evalBarFill,
      els.evalScoreLabel,
      currentEval,
      state.orientation
    );

    updateNavButtons();
    highlightActiveMove();
    renderReviewPanel();
  }

  function updateNavButtons() {
    const hasGame = state.positions.length > 0;
    const maxPly = state.positions.length - 1;
    els.btnFirst.disabled = !hasGame || state.currentPly <= 0;
    els.btnPrev.disabled = !hasGame || state.currentPly <= 0;
    els.btnNext.disabled = !hasGame || state.currentPly >= maxPly;
    els.btnLast.disabled = !hasGame || state.currentPly >= maxPly;
  }

  function goToPly(ply) {
    if (state.positions.length === 0) return;
    const clamped = Math.max(0, Math.min(state.positions.length - 1, ply));
    const changed = clamped !== state.currentPly;
    state.currentPly = clamped;
    if (changed) {
      resetChatForCurrentPly();
    }
    renderCurrentPosition();
  }

  function renderMovesList() {
    if (state.positions.length <= 1) {
      els.movesList.innerHTML = '<div class="empty-state">Nenhuma partida carregada ainda.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (let ply = 1; ply < state.positions.length; ply += 2) {
      const whitePos = state.positions[ply];
      const blackPos = state.positions[ply + 1] || null;

      const row = document.createElement('div');
      row.className = 'move-row';

      const numSpan = document.createElement('span');
      numSpan.className = 'move-num';
      numSpan.textContent = whitePos.moveNumber + '.';
      row.appendChild(numSpan);

      row.appendChild(createMoveButton(whitePos));
      if (blackPos) {
        row.appendChild(createMoveButton(blackPos));
      } else {
        row.appendChild(document.createElement('span'));
      }

      frag.appendChild(row);
    }

    els.movesList.innerHTML = '';
    els.movesList.appendChild(frag);
    highlightActiveMove();
  }

  function createMoveButton(pos) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'move-btn';
    btn.dataset.ply = String(pos.ply);

    const sanSpan = document.createElement('span');
    sanSpan.textContent = pos.san;
    btn.appendChild(sanSpan);

    const badge = state.badgeMap[pos.ply];
    if (badge) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'move-badge-' + badge.key;
      badgeSpan.textContent = badge.symbol;
      btn.appendChild(badgeSpan);
    }

    btn.addEventListener('click', function () {
      goToPly(pos.ply);
    });
    return btn;
  }

  function highlightActiveMove() {
    const buttons = els.movesList.querySelectorAll('.move-btn');
    buttons.forEach(function (btn) {
      const isCurrent = Number(btn.dataset.ply) === state.currentPly;
      btn.classList.toggle('active', isCurrent);
    });
  }

  function getPlayerSideReviews(color) {
    return state.allReviews.filter(function (r) {
      return r.moverColor === color;
    });
  }

  function getFilteredPlayerReviews() {
    const sideMoves = getPlayerSideReviews(state.reviewColor);
    if (state.reviewFilter === 'errors') {
      return sideMoves.filter(function (r) {
        return r.isMistake;
      });
    }
    return sideMoves;
  }

  function findAdjacentPlayerReview(direction) {
    const list = getFilteredPlayerReviews();
    if (list.length === 0) return null;
    if (direction < 0) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i].ply < state.currentPly) return list[i];
      }
      return null;
    }
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].ply > state.currentPly) return list[i];
    }
    return null;
  }

  function navigatePlayerReview(direction) {
    const target = findAdjacentPlayerReview(direction);
    if (target) {
      goToPly(target.ply);
    }
  }

  function formatSummaryCounts(sideMoves) {
    const counts = { melhor: 0, bom: 0, imprecisao: 0, erro: 0, capivara: 0 };
    sideMoves.forEach(function (r) {
      if (counts[r.severity.key] !== undefined) {
        counts[r.severity.key] += 1;
      }
    });
    const parts = [];
    if (counts.melhor > 0) {
      parts.push(counts.melhor + (counts.melhor === 1 ? ' Melhor' : ' Melhores'));
    }
    if (counts.bom > 0) {
      parts.push(counts.bom + (counts.bom === 1 ? ' Bom' : ' Bons'));
    }
    if (counts.imprecisao > 0) {
      parts.push(counts.imprecisao + (counts.imprecisao === 1 ? ' Imprecisão' : ' Imprecisões'));
    }
    if (counts.erro > 0) {
      parts.push(counts.erro + (counts.erro === 1 ? ' Erro' : ' Erros'));
    }
    if (counts.capivara > 0) {
      parts.push(counts.capivara + (counts.capivara === 1 ? ' Capivara' : ' Capivaras'));
    }
    return parts.join(' • ');
  }

  function buildReviewVerdictCard(r) {
    const card = document.createElement('div');
    card.className = 'critical-item severity-' + r.severity.key;

    const moveNotation =
      r.moverColor === 'w' ? r.moveNumber + '. ' + r.playedSan : r.moveNumber + '... ' + r.playedSan;
    const evalBeforeStr = ChessApp.board.formatEvalScore(r.evalBefore);
    const evalAfterStr = ChessApp.board.formatEvalScore(r.evalAfter);

    const top = document.createElement('div');
    top.className = 'critical-top';

    const titleWrap = document.createElement('span');
    titleWrap.className = 'critical-title-wrap';
    if (r.isCritical) {
      const bang = document.createElement('span');
      bang.className = 'critical-bang';
      bang.title = 'Jogada crítica';
      bang.textContent = '!';
      titleWrap.appendChild(bang);
    }

    const title = document.createElement('span');
    title.className = 'critical-move-title';
    title.textContent = 'Lance ' + moveNotation;
    titleWrap.appendChild(title);
    top.appendChild(titleWrap);

    const sevBadge = document.createElement('span');
    sevBadge.className = 'severity-badge ' + r.severity.key;
    sevBadge.textContent =
      r.severity.symbol ? r.severity.label + ' (' + r.severity.symbol + ')' : r.severity.label;
    top.appendChild(sevBadge);

    card.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'critical-meta';
    if (r.isMistake || (r.bestSan && r.bestSan !== r.playedSan)) {
      meta.innerHTML =
        '<span class="' +
        (r.isMistake ? 'move-played-bad' : 'eval-swing') +
        '">Jogado: ' +
        escapeHtml(r.playedSan) +
        '</span>' +
        '<span class="move-best-good">Melhor: ' +
        escapeHtml(r.bestSan) +
        '</span>' +
        '<span class="eval-swing">Avaliação: ' +
        escapeHtml(evalBeforeStr) +
        ' → ' +
        escapeHtml(evalAfterStr) +
        '</span>';
    } else {
      meta.innerHTML =
        '<span class="move-best-good">Melhor lance da posição</span>' +
        '<span class="eval-swing">Avaliação: ' +
        escapeHtml(evalBeforeStr) +
        ' → ' +
        escapeHtml(evalAfterStr) +
        '</span>';
    }
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'critical-actions';

    const explainBtn = document.createElement('button');
    explainBtn.type = 'button';
    explainBtn.className = 'btn btn-ai-explain';

    const isLoading = Boolean(state.loadingExplainPly[r.ply]);
    const cachedAnswer = state.explanations[r.ply];
    const explainErr = state.explainErrors[r.ply];
    explainBtn.disabled = isLoading;
    if (isLoading) {
      explainBtn.textContent = 'Gerando explicação...';
    } else if (cachedAnswer) {
      explainBtn.textContent = 'Atualizar explicação com IA';
    } else {
      explainBtn.textContent = 'Explicar este lance com IA';
    }

    explainBtn.addEventListener('click', function () {
      requestAiExplanation(r, Boolean(cachedAnswer));
    });
    actions.appendChild(explainBtn);

    const isCollapsed = Boolean(state.collapsedExplainPly[r.ply]);
    if (cachedAnswer || explainErr) {
      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'btn btn-collapse-ai' + (isCollapsed ? ' collapsed' : '');
      collapseBtn.title = isCollapsed ? 'Expandir análise' : 'Recolher análise';
      collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expandir análise' : 'Recolher análise');
      collapseBtn.innerHTML = UP_ARROW_SVG;
      collapseBtn.addEventListener('click', function () {
        state.collapsedExplainPly[r.ply] = !state.collapsedExplainPly[r.ply];
        renderReviewPanel();
      });
      actions.appendChild(collapseBtn);
    }

    card.appendChild(actions);

    if (!isCollapsed) {
      if (cachedAnswer) {
        const expBox = document.createElement('div');
        expBox.className = 'ai-explanation-box';
        expBox.innerHTML = formatAiTextSafe(cachedAnswer);
        card.appendChild(expBox);
      } else if (explainErr) {
        const errBox = document.createElement('div');
        errBox.className = 'ai-explanation-box error';
        errBox.textContent = explainErr;
        card.appendChild(errBox);
      }
    }

    return card;
  }

  function renderReviewPanel() {
    const h = state.headers || {};
    const sideName = state.reviewColor === 'b' ? h.Black || 'Pretas' : h.White || 'Brancas';
    els.reviewPanelTitle.textContent =
      state.positions.length > 0 ? 'Revisão: ' + sideName : 'Revisão do Jogador';

    els.btnReviewWhite.classList.toggle('active', state.reviewColor === 'w');
    els.btnReviewBlack.classList.toggle('active', state.reviewColor === 'b');
    els.btnFilterAll.classList.toggle('active', state.reviewFilter === 'all');
    els.btnFilterErrors.classList.toggle('active', state.reviewFilter === 'errors');

    if (state.isAnalyzing && state.allReviews.length === 0) {
      els.reviewSummary.classList.add('hidden');
      els.reviewControls.classList.add('hidden');
      els.reviewMovesList.classList.add('hidden');
      els.reviewCurrentCard.innerHTML =
        '<div class="empty-state">Calculando lances com o Stockfish... a revisão jogada por jogada vai aparecer aqui em instantes.</div>';
      return;
    }

    if (state.allReviews.length === 0) {
      els.reviewSummary.classList.add('hidden');
      els.reviewControls.classList.add('hidden');
      els.reviewMovesList.classList.add('hidden');
      els.reviewCurrentCard.innerHTML =
        '<div class="empty-state">Carregue uma partida para ver a análise jogada por jogada, precisão estimada e marcação (!) nas jogadas críticas.</div>';
      return;
    }

    const sideMoves = getPlayerSideReviews(state.reviewColor);
    const filteredMoves = getFilteredPlayerReviews();

    const avgAcc =
      sideMoves.length > 0
        ? Math.round(
            sideMoves.reduce(function (acc, r) {
              return acc + r.accuracy;
            }, 0) / sideMoves.length
          )
        : 100;

    els.reviewSummary.classList.remove('hidden');
    els.reviewAccuracyPill.textContent = 'Precisão: ' + avgAcc + '%';
    els.reviewCountsText.textContent = formatSummaryCounts(sideMoves);

    els.reviewControls.classList.remove('hidden');

    const prevMove = findAdjacentPlayerReview(-1);
    const nextMove = findAdjacentPlayerReview(1);
    els.btnReviewPrev.disabled = !prevMove;
    els.btnReviewNext.disabled = !nextMove;

    const currentIdx = filteredMoves.findIndex(function (r) {
      return r.ply === state.currentPly;
    });
    els.reviewPositionCounter.textContent =
      (currentIdx >= 0 ? currentIdx + 1 : 0) + ' / ' + filteredMoves.length;

    els.reviewCurrentCard.innerHTML = '';
    const activeReview = state.reviewsByPly[state.currentPly];
    if (activeReview && activeReview.moverColor === state.reviewColor) {
      els.reviewCurrentCard.appendChild(buildReviewVerdictCard(activeReview));
    } else if (filteredMoves.length === 0) {
      els.reviewCurrentCard.innerHTML =
        '<div class="empty-state">Nenhum erro encontrado para ' +
        escapeHtml(sideName) +
        ' nesta partida.</div>';
    } else {
      const hintBox = document.createElement('div');
      hintBox.className = 'critical-item';
      const hintTitle =
        state.currentPly === 0
          ? 'Posição inicial da partida.'
          : 'Lance do adversário no tabuleiro.';
      hintBox.innerHTML =
        '<div class="eval-swing" style="margin-bottom:8px;">' +
        hintTitle +
        ' Navegue pelas jogadas de ' +
        escapeHtml(sideName) +
        ' abaixo.</div>';
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'btn btn-ai-explain';
      const jumpTarget = nextMove || prevMove || filteredMoves[0];
      jumpBtn.textContent = nextMove
        ? 'Ir para próxima jogada'
        : 'Ver última jogada analisada';
      jumpBtn.addEventListener('click', function () {
        if (jumpTarget) goToPly(jumpTarget.ply);
      });
      hintBox.appendChild(jumpBtn);
      els.reviewCurrentCard.appendChild(hintBox);
    }

    if (filteredMoves.length === 0) {
      els.reviewMovesList.classList.add('hidden');
      els.reviewMovesList.innerHTML = '';
      return;
    }

    els.reviewMovesList.classList.remove('hidden');
    const frag = document.createDocumentFragment();
    filteredMoves.forEach(function (r) {
      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.className = 'review-move-row severity-' + r.severity.key;
      if (r.ply === state.currentPly) {
        rowBtn.classList.add('active');
      }

      const left = document.createElement('span');
      left.className = 'review-move-left';
      const notation =
        r.moverColor === 'w' ? r.moveNumber + '. ' + r.playedSan : r.moveNumber + '... ' + r.playedSan;

      if (r.isCritical) {
        const bang = document.createElement('span');
        bang.className = 'critical-bang';
        bang.title = 'Jogada crítica';
        bang.textContent = '!';
        left.appendChild(bang);
      }

      const moveText = document.createElement('span');
      moveText.textContent = notation;
      left.appendChild(moveText);
      rowBtn.appendChild(left);

      const right = document.createElement('span');
      right.className = 'review-move-right';

      const sev = document.createElement('span');
      sev.className = 'severity-badge ' + r.severity.key;
      sev.textContent = r.severity.symbol ? r.severity.label + ' ' + r.severity.symbol : r.severity.label;
      right.appendChild(sev);

      const evalSpan = document.createElement('span');
      evalSpan.className = 'review-row-eval';
      evalSpan.textContent = ChessApp.board.formatEvalScore(r.evalAfter);
      right.appendChild(evalSpan);

      rowBtn.appendChild(right);

      rowBtn.addEventListener('click', function () {
        goToPly(r.ply);
      });

      frag.appendChild(rowBtn);
    });

    els.reviewMovesList.innerHTML = '';
    els.reviewMovesList.appendChild(frag);
  }

  async function requestAiExplanation(moment, forceRefresh) {
    const settings = ChessApp.ai.getSettings();
    if (!ChessApp.ai.getActiveKey(settings)) {
      openSettingsModal(
        'Para explicar este lance com IA, cole sua chave gratuita do Google Gemini ou da Groq abaixo.'
      );
      return;
    }

    state.loadingExplainPly[moment.ply] = true;
    state.collapsedExplainPly[moment.ply] = false;
    delete state.explainErrors[moment.ply];
    renderReviewPanel();

    try {
      const answer = await ChessApp.ai.explainCriticalMove(moment, state.gameId, {
        forceRefresh: Boolean(forceRefresh)
      });
      state.explanations[moment.ply] = answer;
    } catch (err) {
      if (err && err.code === 'NO_API_KEY') {
        openSettingsModal(
          'Cole sua chave gratuita do Google Gemini ou da Groq abaixo para continuar.'
        );
      } else {
        state.explainErrors[moment.ply] = err.message || 'Não foi possível gerar a explicação.';
      }
    } finally {
      state.loadingExplainPly[moment.ply] = false;
      renderReviewPanel();
    }
  }

  // Mini-Chat sobre a Posição Atual
  function getCurrentPositionMeta() {
    if (state.positions.length === 0 || state.currentPly === 0) {
      const fen0 = state.positions[0] ? state.positions[0].fen : START_FEN;
      const turn0 = state.positions[0] ? state.positions[0].turn : 'w';
      return {
        fen: fen0,
        turn: turn0,
        label: 'Posição inicial (' + (turn0 === 'w' ? 'vez das Brancas' : 'vez das Pretas') + ')'
      };
    }
    const pos = state.positions[state.currentPly];
    const moveLabel =
      pos.color === 'w' ? pos.moveNumber + '. ' + pos.san : pos.moveNumber + '... ' + pos.san;
    const turnLabel = pos.turn === 'w' ? 'vez das Brancas' : 'vez das Pretas';
    return {
      fen: pos.fen,
      turn: pos.turn,
      label: 'Lance ' + moveLabel + ' (' + turnLabel + ')'
    };
  }

  function renderChatMessages() {
    if (!els.chatMessages) return;
    els.btnChatSend.disabled = state.chatBusy;

    if (state.chatMessages.length === 0 && !state.chatStatus) {
      els.chatMessages.innerHTML =
        '<div class="chat-empty-state">Pergunte sobre o lance ou posição atual (ex: "por que não posso jogar Cf6?" ou "qual o plano aqui?"). O Stockfish calcula primeiro antes da IA responder.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    state.chatMessages.forEach(function (msg) {
      const div = document.createElement('div');
      if (msg.role === 'user') {
        div.className = 'chat-msg chat-msg-user';
        div.textContent = msg.content;
      } else if (msg.role === 'error') {
        div.className = 'chat-msg chat-msg-error';
        div.textContent = msg.content;
      } else {
        div.className = 'chat-msg chat-msg-assistant';
        div.innerHTML = formatAiTextSafe(msg.content);

        if (Array.isArray(msg.moves) && msg.moves.length > 0) {
          const chipsWrap = document.createElement('div');
          chipsWrap.className = 'chat-move-chips';
          msg.moves.forEach(function (mv) {
            const chip = document.createElement('button');
            chip.type = 'button';
            const isSelected =
              state.chatArrow &&
              state.chatArrow.from === mv.from &&
              state.chatArrow.to === mv.to;
            chip.className = 'chat-move-chip' + (isSelected ? ' active' : '');
            chip.textContent = 'Seta: ' + mv.san;
            chip.addEventListener('click', function () {
              if (
                state.chatArrow &&
                state.chatArrow.from === mv.from &&
                state.chatArrow.to === mv.to
              ) {
                state.chatArrow = null;
              } else {
                state.chatArrow = { from: mv.from, to: mv.to, san: mv.san };
              }
              renderChatMessages();
              renderCurrentPosition();
            });
            chipsWrap.appendChild(chip);
          });
          div.appendChild(chipsWrap);
        }
      }
      frag.appendChild(div);
    });

    if (state.chatStatus) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'chat-msg-status';
      statusDiv.textContent = state.chatStatus;
      frag.appendChild(statusDiv);
    }

    els.chatMessages.innerHTML = '';
    els.chatMessages.appendChild(frag);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function resetChatForCurrentPly() {
    state.chatRequestId += 1;
    state.chatBusy = false;
    state.chatStatus = '';
    state.chatMessages = [];
    state.chatArrow = null;

    if (els.chatContextBadge) {
      els.chatContextBadge.textContent = getCurrentPositionMeta().label;
    }
    renderChatMessages();
  }

  function buildChatSystemContext(meta, analysis) {
    const sideToMove = meta.turn === 'w' ? 'Brancas' : 'Pretas';
    const current = analysis.current;
    let engineLinesText = '';

    if (current.terminal === 'checkmate') {
      engineLinesText = 'Posição terminal: xeque-mate no tabuleiro.';
    } else if (current.terminal === 'draw') {
      engineLinesText = 'Posição terminal: empate (afogamento/material insuficiente/regra).';
    } else {
      const topEval = ChessApp.board.formatEvalScore(current.evalObj);
      const formattedLines = current.lines
        .map(function (ln, i) {
          const ev = ChessApp.board.formatEvalScore(ln.evalObj);
          return (
            (i + 1) +
            ') ' +
            ln.bestSan +
            ' (aval: ' +
            ev +
            ', sequência: ' +
            ln.pvSan.join(' ') +
            ')'
          );
        })
        .join('\n');
      engineLinesText =
        'Avaliação geral (visão das Brancas): ' +
        topEval +
        '\nMelhores lances calculados pelo Stockfish:\n' +
        formattedLines;
    }

    let altText = '';
    if (analysis.alternative) {
      const alt = analysis.alternative;
      if (!alt.legal) {
        altText =
          '\n\nLance citado pelo usuário ("' +
          alt.rawToken +
          '"): ESTE LANCE É ILEGAL nesta posição.';
      } else if (alt.terminal === 'checkmate') {
        altText =
          '\n\nLance alternativo testado (' + alt.san + '): é legal e aplica XEQUE-MATE imediato.';
      } else if (alt.terminal === 'draw') {
        altText =
          '\n\nLance alternativo testado (' + alt.san + '): é legal e resulta em empate imediato.';
      } else {
        const altEval = ChessApp.board.formatEvalScore(alt.evalAfter);
        altText =
          '\n\nLance alternativo testado (' +
          alt.san +
          '): é legal. Após ' +
          alt.san +
          ', a avaliação (visão das Brancas) passa para ' +
          altEval +
          (alt.replySan
            ? ' e a melhor resposta do adversário é ' +
              alt.replySan +
              ' (linha: ' +
              alt.pvSan.join(' ') +
              ')'
            : '') +
          '.';
      }
    }

    return (
      'Você é um analista de xadrez objetivo respondendo em português do Brasil.\n' +
      'Contexto da posição atual:\n' +
      '- Momento: ' +
      meta.label +
      '\n- Vez de jogar: ' +
      sideToMove +
      '\n- FEN: ' +
      meta.fen +
      '\n\nCálculos reais do Stockfish na posição atual:\n' +
      engineLinesText +
      altText +
      '\n\nRegras obrigatórias:\n' +
      '1. Responda em português do Brasil de forma direta e objetiva (máximo 3 a 4 frases curtas).\n' +
      '2. Sem saudações, sem introdução e sem dicas genéricas.\n' +
      '3. Baseie-se estritamente nos cálculos do Stockfish acima e nunca sugira lances ilegais.'
    );
  }

  function collectChatMoveChips(answerText, meta, analysis) {
    const chips = [];
    const seen = new Set();

    function pushMove(mv) {
      if (!mv || !mv.from || !mv.to || !mv.san || seen.has(mv.san)) return;
      seen.add(mv.san);
      chips.push({ san: mv.san, from: mv.from, to: mv.to });
    }

    const aiMentioned = ChessApp.engine.findMovesInText(answerText, meta.fen);
    aiMentioned.forEach(pushMove);

    if (analysis.current && Array.isArray(analysis.current.lines)) {
      analysis.current.lines.slice(0, 2).forEach(function (ln) {
        pushMove({ san: ln.bestSan, from: ln.from, to: ln.to });
      });
    }

    if (analysis.alternative && analysis.alternative.legal) {
      pushMove({
        san: analysis.alternative.san,
        from: analysis.alternative.from,
        to: analysis.alternative.to
      });
    }

    return chips.slice(0, 4);
  }

  async function handleChatSubmit(ev) {
    ev.preventDefault();
    if (state.chatBusy) return;

    const question = els.chatInput.value.trim();
    if (!question) return;

    const settings = ChessApp.ai.getSettings();
    if (!ChessApp.ai.getActiveKey(settings)) {
      openSettingsModal(
        'Para usar o chat sobre a posição, cole sua chave gratuita do Google Gemini ou da Groq abaixo.'
      );
      return;
    }

    els.chatInput.value = '';
    const reqId = state.chatRequestId;
    const meta = getCurrentPositionMeta();

    state.chatMessages.push({ role: 'user', content: question });
    state.chatBusy = true;
    state.chatStatus = 'Calculando posição no Stockfish...';
    renderChatMessages();

    try {
      const analysis = await ChessApp.engine.analyzeForChat(meta.fen, meta.turn, question);
      if (reqId !== state.chatRequestId) return;

      state.chatStatus = 'Consultando IA...';
      renderChatMessages();

      const systemContext = buildChatSystemContext(meta, analysis);
      const recentHistory = state.chatMessages
        .filter(function (m) {
          return m.role === 'user' || m.role === 'assistant';
        })
        .slice(-6);

      const answer = await ChessApp.ai.askPositionChat({
        systemContext: systemContext,
        messages: recentHistory
      });
      if (reqId !== state.chatRequestId) return;

      const chips = collectChatMoveChips(answer, meta, analysis);
      state.chatArrow = chips.length > 0 ? { from: chips[0].from, to: chips[0].to, san: chips[0].san } : null;

      state.chatMessages.push({
        role: 'assistant',
        content: answer,
        moves: chips
      });
      state.chatBusy = false;
      state.chatStatus = '';
      renderChatMessages();
      renderCurrentPosition();
    } catch (err) {
      if (reqId !== state.chatRequestId) return;
      state.chatBusy = false;
      state.chatStatus = '';
      if (err && err.code === 'NO_API_KEY') {
        openSettingsModal(
          'Cole sua chave gratuita do Google Gemini ou da Groq abaixo para continuar.'
        );
      } else {
        state.chatMessages.push({
          role: 'error',
          content: err.message || 'Não foi possível responder à pergunta.'
        });
      }
      renderChatMessages();
    }
  }

  function startAnalysis(depth) {
    if (state.positions.length <= 1) return;

    const isDeep = depth >= DEEP_DEPTH;
    state.isAnalyzing = true;
    state.analysisDepth = depth;
    state.allReviews = [];
    state.reviewsByPly = {};
    state.badgeMap = {};

    els.btnDeepAnalysis.disabled = true;
    els.analysisProgressBar.style.width = '0%';
    els.analysisStatusText.textContent =
      (isDeep ? 'Análise profunda' : 'Análise rápida') +
      ' (profundidade ' +
      depth +
      '): iniciando Stockfish...';

    renderMovesList();
    renderReviewPanel();
    renderCurrentPosition();

    ChessApp.engine.analyzeGame(state.positions, depth, {
      onProgress: function (info) {
        const pct = Math.round((info.completed / info.total) * 100);
        state.evals = info.evals;
        state.bestMoves = info.bestMoves;
        els.analysisProgressBar.style.width = pct + '%';
        els.analysisStatusText.textContent =
          (isDeep ? 'Análise profunda' : 'Análise rápida') +
          ': analisando posição ' +
          info.completed +
          ' de ' +
          info.total +
          ' (' +
          pct +
          '%)';

        if (info.ply === state.currentPly) {
          ChessApp.board.updateEvalBar(
            els.evalBar,
            els.evalBarFill,
            els.evalScoreLabel,
            state.evals[state.currentPly],
            state.orientation
          );
        }
      },
      onComplete: function (result) {
        state.isAnalyzing = false;
        state.evals = result.evals;
        state.bestMoves = result.bestMoves;
        state.allReviews = result.allReviews || [];
        state.reviewsByPly = result.reviewsByPly || {};
        state.badgeMap = result.badgeMap || {};

        const criticalCount = getPlayerSideReviews(state.reviewColor).filter(function (r) {
          return r.isCritical;
        }).length;

        els.analysisProgressBar.style.width = '100%';
        if (result.depth >= DEEP_DEPTH) {
          els.analysisStatusText.textContent =
            'Análise profunda concluída (profundidade ' + result.depth + ').';
          els.btnDeepAnalysis.disabled = true;
        } else {
          els.analysisStatusText.textContent =
            'Análise rápida concluída (profundidade ' +
            result.depth +
            '). ' +
            criticalCount +
            ' jogada(s) crítica(s) marcada(s) com (!).';
          els.btnDeepAnalysis.disabled = false;
        }

        renderMovesList();
        renderReviewPanel();
        renderCurrentPosition();
      },
      onError: function (err) {
        state.isAnalyzing = false;
        els.btnDeepAnalysis.disabled = false;
        els.analysisStatusText.textContent = err.message || 'Erro ao executar o Stockfish.';
        renderReviewPanel();
      }
    });
  }

  function loadGameFromPgn(pgnText, options) {
    const opts = options || {};
    ChessApp.engine.cancelAnalysis();

    const parsed = parsePgnToPositions(pgnText);

    state.gameId = opts.gameId || 'pgn-' + Date.now();
    state.headers = parsed.headers;
    state.positions = parsed.positions;
    state.orientation = opts.orientation === 'black' ? 'black' : 'white';
    state.reviewColor = state.orientation === 'black' ? 'b' : 'w';
    state.reviewFilter = 'all';
    state.currentPly = parsed.positions.length - 1;
    state.evals = new Array(parsed.positions.length).fill(null);
    state.bestMoves = new Array(parsed.positions.length).fill(null);
    state.allReviews = [];
    state.reviewsByPly = {};
    state.badgeMap = {};
    state.explanations = {};
    state.loadingExplainPly = {};
    state.explainErrors = {};
    state.collapsedExplainPly = {};

    if (parsed.headers && parsed.headers.Result) {
      els.gameResultBadge.textContent = 'Resultado: ' + parsed.headers.Result;
      els.gameResultBadge.classList.remove('hidden');
    } else {
      els.gameResultBadge.classList.add('hidden');
    }

    resetChatForCurrentPly();
    updatePlayerBars();
    renderMovesList();
    renderCurrentPosition();
    startAnalysis(FAST_DEPTH);
  }

  function renderRecentGamesList(username) {
    const games = state.recentGames;
    if (!games || games.length === 0) {
      els.recentGamesSection.classList.add('hidden');
      return;
    }

    els.recentGamesTitle.textContent =
      'Últimas ' + games.length + ' Partidas de ' + username + ' no Chess.com';
    els.recentGamesSection.classList.remove('hidden');

    const frag = document.createDocumentFragment();
    games.forEach(function (g) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recent-game-item';
      if (g.id === state.activeRecentGameId) {
        btn.classList.add('active');
      }

      const colorDotHtml =
        '<span class="recent-color-label"><span class="color-dot ' +
        (g.userColor === 'white' ? 'color-white' : 'color-black') +
        '" aria-hidden="true"></span>' +
        (g.userColor === 'white' ? 'Brancas' : 'Pretas') +
        '</span>';
      const oppRating = g.opponentRating ? ' (' + g.opponentRating + ')' : '';

      btn.innerHTML =
        '<div class="recent-game-top">' +
        '<span class="recent-game-opponent">vs ' +
        escapeHtml(g.opponent + oppRating) +
        '</span>' +
        '<span class="recent-result-pill ' +
        g.resultCss +
        '">' +
        escapeHtml(g.resultLabel) +
        '</span>' +
        '</div>' +
        '<div class="recent-game-meta">' +
        '<span>' +
        colorDotHtml +
        ' • ' +
        escapeHtml(g.timeClass) +
        '</span>' +
        '<span>' +
        escapeHtml(g.dateStr) +
        '</span>' +
        '</div>';

      btn.addEventListener('click', function () {
        cancelPendingChessComSearch();
        state.activeRecentGameId = g.id;
        renderRecentGamesList(username);
        try {
          loadGameFromPgn(g.pgn, {
            gameId: g.id,
            orientation: g.userColor
          });
          showLoaderFeedback(
            'Partida contra ' + g.opponent + ' carregada. Iniciando análise...',
            'success'
          );
        } catch (err) {
          showLoaderFeedback(err.message, 'error');
        }
      });

      frag.appendChild(btn);
    });

    els.recentGamesList.innerHTML = '';
    els.recentGamesList.appendChild(frag);
  }

  function getSavedChessComUsername() {
    try {
      return (global.localStorage.getItem(CHESSCOM_USER_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function saveChessComUsername(username) {
    try {
      const clean = (username || '').trim();
      if (clean) {
        global.localStorage.setItem(CHESSCOM_USER_STORAGE_KEY, clean);
      }
    } catch (e) {}
  }

  function cancelPendingChessComSearch() {
    state.searchRequestId += 1;
    if (els.btnFetchChesscom) {
      els.btnFetchChesscom.disabled = false;
      els.btnFetchChesscom.textContent = 'Buscar partidas';
    }
  }

  async function searchChessComUser(rawUsername) {
    const username = (rawUsername || '').trim();
    if (!username) {
      showLoaderFeedback('Digite o nome de usuário do Chess.com para buscar.', 'error');
      return;
    }

    state.searchRequestId += 1;
    const reqId = state.searchRequestId;

    els.btnFetchChesscom.disabled = true;
    els.btnFetchChesscom.textContent = 'Buscando...';
    showLoaderFeedback('Buscando partidas recentes de "' + username + '" no Chess.com...', '');

    try {
      const games = await ChessApp.chesscom.fetchRecentGames(username, 20);
      if (reqId !== state.searchRequestId) return;

      const resolvedName = games[0].userName || username;
      saveChessComUsername(resolvedName);
      els.chesscomUsername.value = resolvedName;

      state.recentGames = games;
      state.activeRecentGameId = games[0].id;
      renderRecentGamesList(resolvedName);

      loadGameFromPgn(games[0].pgn, {
        gameId: games[0].id,
        orientation: games[0].userColor
      });

      showLoaderFeedback(
        'Última partida de ' +
          resolvedName +
          ' carregada. Você também pode escolher entre as ' +
          games.length +
          ' partidas listadas abaixo.',
        'success'
      );
    } catch (err) {
      if (reqId !== state.searchRequestId) return;
      showLoaderFeedback(err.message || 'Erro ao buscar partidas.', 'error');
    } finally {
      if (reqId === state.searchRequestId) {
        els.btnFetchChesscom.disabled = false;
        els.btnFetchChesscom.textContent = 'Buscar partidas';
      }
    }
  }

  function handleChessComSearch(e) {
    e.preventDefault();
    searchChessComUser(els.chesscomUsername.value);
  }

  function handleLoadPgnClick() {
    const text = els.pgnInput.value.trim();
    if (!text) {
      showLoaderFeedback('Cole o texto PGN da partida antes de clicar em carregar.', 'error');
      return;
    }
    try {
      cancelPendingChessComSearch();
      state.activeRecentGameId = null;
      loadGameFromPgn(text, { orientation: 'white' });
      showLoaderFeedback('PGN carregado com sucesso. Analisando os lances...', 'success');
    } catch (err) {
      showLoaderFeedback(err.message, 'error');
    }
  }

  function refreshAiStatusBadge() {
    const settings = ChessApp.ai.getSettings();
    const key = ChessApp.ai.getActiveKey(settings);
    if (key) {
      const label = settings.provider === 'groq' ? 'Groq ativo' : 'Gemini ativo';
      if (els.aiSettingsLabel) {
        els.aiSettingsLabel.classList.add('hidden');
      }
      els.aiStatusBadge.textContent = label;
      els.aiStatusBadge.className = 'status-pill status-pill-on';
    } else {
      if (els.aiSettingsLabel) {
        els.aiSettingsLabel.classList.remove('hidden');
      }
      els.aiStatusBadge.textContent = 'Sem chave';
      els.aiStatusBadge.className = 'status-pill status-pill-off';
    }
  }

  function populateModelOptions(provider, selectedModel, customList) {
    const info = ChessApp.ai.PROVIDERS[provider] || ChessApp.ai.PROVIDERS.gemini;
    const list = (customList && customList.length > 0 ? customList : info.models).slice();
    if (
      selectedModel &&
      !list.some(function (m) {
        return m.id === selectedModel;
      })
    ) {
      list.unshift({ id: selectedModel, label: selectedModel + ' (salvo)' });
    }
    els.aiModelSelect.innerHTML = '';
    list.forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === selectedModel) {
        opt.selected = true;
      }
      els.aiModelSelect.appendChild(opt);
    });
  }

  async function handleRefreshModelsClick() {
    const provider = els.aiProviderSelect.value === 'groq' ? 'groq' : 'gemini';
    const key = els.aiApiKeyInput.value.trim();
    if (!key) {
      els.settingsNotice.textContent =
        'Cole sua chave da API abaixo primeiro para detectar os modelos ativos da sua conta.';
      els.settingsNotice.classList.remove('hidden');
      return;
    }

    els.btnRefreshModels.disabled = true;
    els.btnRefreshModels.textContent = 'Buscando...';
    try {
      const models = await ChessApp.ai.fetchAvailableModels(provider, key);
      if (models.length === 0) {
        els.settingsNotice.textContent = 'Nenhum modelo compatível foi encontrado para essa chave.';
        els.settingsNotice.classList.remove('hidden');
        return;
      }
      const currentSelected = els.aiModelSelect.value;
      const keepSelected = models.some(function (m) {
        return m.id === currentSelected;
      })
        ? currentSelected
        : models[0].id;
      populateModelOptions(provider, keepSelected, models);
      els.settingsNotice.textContent =
        models.length +
        ' modelo(s) ativo(s) encontrado(s) na sua conta. Escolha um acima e clique em Salvar.';
      els.settingsNotice.classList.remove('hidden');
    } catch (err) {
      els.settingsNotice.textContent = err.message || 'Erro ao detectar modelos disponíveis.';
      els.settingsNotice.classList.remove('hidden');
    } finally {
      els.btnRefreshModels.disabled = false;
      els.btnRefreshModels.textContent = 'Detectar';
    }
  }

  function syncSettingsModalFields(providerOverride) {
    const settings = ChessApp.ai.getSettings();
    const provider = providerOverride || settings.provider || 'gemini';
    els.aiProviderSelect.value = provider;
    const model = provider === 'groq' ? settings.groqModel : settings.geminiModel;
    populateModelOptions(provider, model);
    els.aiApiKeyInput.value = provider === 'groq' ? settings.groqKey : settings.geminiKey;
    els.aiApiKeyInput.placeholder =
      provider === 'groq' ? 'Cole sua chave da Groq (gsk_...)' : 'Cole sua chave do Gemini (AIza...)';
  }

  function openSettingsModal(noticeMsg) {
    syncSettingsModalFields();
    els.aiApiKeyInput.type = 'password';
    els.btnToggleKeyVisibility.textContent = 'Mostrar';
    if (noticeMsg) {
      els.settingsNotice.textContent = noticeMsg;
      els.settingsNotice.classList.remove('hidden');
    } else {
      els.settingsNotice.classList.add('hidden');
    }
    els.settingsModal.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  function openTutorialModal(tabName) {
    switchTutorialTab(tabName || 'gemini');
    els.tutorialModal.classList.remove('hidden');
  }

  function switchTutorialTab(tabName) {
    const tabBtns = els.tutorialModal.querySelectorAll('.tutorial-tab-btn');
    tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tutorialTab === tabName);
    });
    ['gemini', 'groq'].forEach(function (name) {
      const panel = document.getElementById('tutorial-panel-' + name);
      if (panel) {
        panel.classList.toggle('hidden', name !== tabName);
        panel.classList.toggle('active', name === tabName);
      }
    });
  }

  function bindEvents() {
    els.tabBtnChesscom.addEventListener('click', function () {
      switchInputTab('chesscom');
    });
    els.tabBtnPgn.addEventListener('click', function () {
      switchInputTab('pgn');
    });

    els.chesscomForm.addEventListener('submit', handleChessComSearch);
    els.btnLoadPgn.addEventListener('click', handleLoadPgnClick);

    els.btnFirst.addEventListener('click', function () {
      goToPly(0);
    });
    els.btnPrev.addEventListener('click', function () {
      goToPly(state.currentPly - 1);
    });
    els.btnNext.addEventListener('click', function () {
      goToPly(state.currentPly + 1);
    });
    els.btnLast.addEventListener('click', function () {
      goToPly(state.positions.length - 1);
    });
    els.btnFlip.addEventListener('click', function () {
      state.orientation = state.orientation === 'white' ? 'black' : 'white';
      updatePlayerBars();
      renderCurrentPosition();
    });

    els.btnDeepAnalysis.addEventListener('click', function () {
      startAnalysis(DEEP_DEPTH);
    });

    els.btnReviewWhite.addEventListener('click', function () {
      if (state.reviewColor === 'w') return;
      state.reviewColor = 'w';
      renderReviewPanel();
    });
    els.btnReviewBlack.addEventListener('click', function () {
      if (state.reviewColor === 'b') return;
      state.reviewColor = 'b';
      renderReviewPanel();
    });
    els.btnFilterAll.addEventListener('click', function () {
      if (state.reviewFilter === 'all') return;
      state.reviewFilter = 'all';
      renderReviewPanel();
    });
    els.btnFilterErrors.addEventListener('click', function () {
      if (state.reviewFilter === 'errors') return;
      state.reviewFilter = 'errors';
      renderReviewPanel();
    });
    els.btnReviewPrev.addEventListener('click', function () {
      navigatePlayerReview(-1);
    });
    els.btnReviewNext.addEventListener('click', function () {
      navigatePlayerReview(1);
    });

    els.chatForm.addEventListener('submit', handleChatSubmit);
    els.btnClearChat.addEventListener('click', function () {
      resetChatForCurrentPly();
      renderCurrentPosition();
    });

    els.btnOpenSettings.addEventListener('click', function () {
      openSettingsModal();
    });
    els.btnOpenTutorial.addEventListener('click', function () {
      openTutorialModal('gemini');
    });
    els.btnOpenTutorialFromSettings.addEventListener('click', function () {
      const prov = els.aiProviderSelect.value === 'groq' ? 'groq' : 'gemini';
      closeModal('settings-modal');
      openTutorialModal(prov);
    });
    els.btnGoSettingsFromTutorial.addEventListener('click', function () {
      closeModal('tutorial-modal');
      openSettingsModal();
    });

    els.aiProviderSelect.addEventListener('change', function () {
      syncSettingsModalFields(els.aiProviderSelect.value);
    });
    els.btnRefreshModels.addEventListener('click', handleRefreshModelsClick);

    els.btnToggleKeyVisibility.addEventListener('click', function () {
      const isHidden = els.aiApiKeyInput.type === 'password';
      els.aiApiKeyInput.type = isHidden ? 'text' : 'password';
      els.btnToggleKeyVisibility.textContent = isHidden ? 'Ocultar' : 'Mostrar';
    });

    els.btnSaveSettings.addEventListener('click', function () {
      const current = ChessApp.ai.getSettings();
      const provider = els.aiProviderSelect.value === 'groq' ? 'groq' : 'gemini';
      const key = els.aiApiKeyInput.value.trim();
      const model = els.aiModelSelect.value;

      current.provider = provider;
      if (provider === 'groq') {
        current.groqKey = key;
        current.groqModel = model;
      } else {
        current.geminiKey = key;
        current.geminiModel = model;
      }

      ChessApp.ai.saveSettings(current);
      refreshAiStatusBadge();
      closeModal('settings-modal');
    });

    els.btnClearSettings.addEventListener('click', function () {
      ChessApp.ai.clearSettings();
      syncSettingsModalFields('gemini');
      refreshAiStatusBadge();
    });

    document.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeModal(el.dataset.closeModal);
      });
    });

    els.tutorialModal.querySelectorAll('.tutorial-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTutorialTab(btn.dataset.tutorialTab);
      });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        closeModal('settings-modal');
        closeModal('tutorial-modal');
        return;
      }
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        goToPly(state.currentPly - 1);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        goToPly(state.currentPly + 1);
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        goToPly(0);
      } else if (ev.key === 'End') {
        ev.preventDefault();
        goToPly(state.positions.length - 1);
      } else if (ev.key === 'f' || ev.key === 'F') {
        state.orientation = state.orientation === 'white' ? 'black' : 'white';
        updatePlayerBars();
        renderCurrentPosition();
      }
    });
  }

  function init() {
    if (global.location && global.location.protocol === 'file:') {
      const banner = document.getElementById('file-protocol-banner');
      if (banner) banner.classList.remove('hidden');
    }

    cacheDom();
    bindEvents();
    refreshAiStatusBadge();
    resetChatForCurrentPly();
    updatePlayerBars();
    renderCurrentPosition();

    const savedUser = getSavedChessComUsername();
    if (savedUser) {
      els.chesscomUsername.value = savedUser;
      searchChessComUser(savedUser);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
