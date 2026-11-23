(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const FAST_DEPTH = 10;
  const DEEP_DEPTH = 15;
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const SAMPLE_PGN = `[Event "Partida de Exemplo - Ataque no Roque"]
[Site "Chess Analyzer"]
[Date "2026.11.20"]
[White "Jogador Local"]
[Black "Amigo"]
[WhiteElo "950"]
[BlackElo "940"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. O-O d6 6. Bg5 h6 7. Bh4 g5 8. Bg3 h5
9. Nxg5 h4 10. Nxf7 hxg3 11. Nxd8 Bg4 12. Qd2 Nd4 13. Nc3 Nf3+ 14. gxf3 Bxf3
15. hxg3 Rh1# 0-1`;

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
    criticalMoments: [],
    criticalByPly: {},
    badgeMap: {},
    explanations: {},
    loadingExplainPly: {},
    explainErrors: {},
    collapsedExplainPly: {},
    analysisDepth: null,
    isAnalyzing: false,
    recentGames: [],
    activeRecentGameId: null,
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
    els.btnLoadSample = document.getElementById('btn-load-sample');
    els.btnLoadSamplePgn = document.getElementById('btn-load-sample-pgn');
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
    els.criticalCountBadge = document.getElementById('critical-count-badge');
    els.criticalMomentsList = document.getElementById('critical-moments-list');
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

  function parsePgnToPositions(pgnText) {
    if (typeof global.Chess !== 'function') {
      throw new Error('Biblioteca Chess.js não foi carregada.');
    }

    const chess = new global.Chess();
    const ok = chess.load_pgn(pgnText.trim(), { sloppy: true });
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

    const critical = state.criticalByPly[state.currentPly];
    if (critical) {
      if (critical.playedFrom && critical.playedTo) {
        arrows.push({ from: critical.playedFrom, to: critical.playedTo, color: '#ef4444' });
        hasRed = true;
      }
      if (critical.bestFrom && critical.bestTo) {
        arrows.push({ from: critical.bestFrom, to: critical.bestTo, color: '#22c55e' });
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
    highlightActiveCriticalCard();
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

  function highlightActiveCriticalCard() {
    const cards = els.criticalMomentsList.querySelectorAll('.critical-item');
    cards.forEach(function (card) {
      card.classList.toggle('active', Number(card.dataset.ply) === state.currentPly);
    });
  }

  function renderCriticalMoments() {
    const moments = state.criticalMoments;
    if (state.isAnalyzing && moments.length === 0) {
      els.criticalCountBadge.classList.add('hidden');
      els.criticalMomentsList.innerHTML =
        '<div class="empty-state">Calculando lances com o Stockfish... os principais erros vão aparecer aqui em instantes.</div>';
      return;
    }

    if (!moments || moments.length === 0) {
      els.criticalCountBadge.classList.add('hidden');
      if (state.positions.length > 0 && !state.isAnalyzing) {
        els.criticalMomentsList.innerHTML =
          '<div class="empty-state">Partida sólida. O Stockfish não encontrou erros graves.</div>';
      } else {
        els.criticalMomentsList.innerHTML =
          '<div class="empty-state">Os principais erros da partida aparecerão aqui assim que a análise terminar. Clique em qualquer um para ver as setas vermelha e verde no tabuleiro.</div>';
      }
      return;
    }

    els.criticalCountBadge.textContent = String(moments.length);
    els.criticalCountBadge.classList.remove('hidden');

    const frag = document.createDocumentFragment();
    moments.forEach(function (m, idx) {
      const card = document.createElement('div');
      card.className = 'critical-item severity-' + m.severity.key;
      card.dataset.ply = String(m.ply);
      if (state.currentPly === m.ply) {
        card.classList.add('active');
      }

      const moveNotation =
        m.moverColor === 'w' ? m.moveNumber + '. ' + m.playedSan : m.moveNumber + '... ' + m.playedSan;
      const evalBeforeStr = ChessApp.board.formatEvalScore(m.evalBefore);
      const evalAfterStr = ChessApp.board.formatEvalScore(m.evalAfter);

      const top = document.createElement('div');
      top.className = 'critical-top';

      const title = document.createElement('span');
      title.className = 'critical-move-title';
      title.textContent = '#' + (idx + 1) + ' • Lance ' + moveNotation;
      top.appendChild(title);

      const sevBadge = document.createElement('span');
      sevBadge.className = 'severity-badge ' + m.severity.key;
      sevBadge.textContent = m.severity.label + ' (' + m.severity.symbol + ')';
      top.appendChild(sevBadge);

      card.appendChild(top);

      const meta = document.createElement('div');
      meta.className = 'critical-meta';
      meta.innerHTML =
        '<span class="move-played-bad">Jogado: ' +
        escapeHtml(m.playedSan) +
        '</span>' +
        '<span class="move-best-good">Melhor: ' +
        escapeHtml(m.bestSan) +
        '</span>' +
        '<span class="eval-swing">Avaliação: ' +
        escapeHtml(evalBeforeStr) +
        ' → ' +
        escapeHtml(evalAfterStr) +
        '</span>';
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'critical-actions';

      const explainBtn = document.createElement('button');
      explainBtn.type = 'button';
      explainBtn.className = 'btn btn-ai-explain';

      const isLoading = Boolean(state.loadingExplainPly[m.ply]);
      const cachedAnswer = state.explanations[m.ply];
      const explainErr = state.explainErrors[m.ply];
      explainBtn.disabled = isLoading;
      if (isLoading) {
        explainBtn.textContent = 'Gerando explicação...';
      } else if (cachedAnswer) {
        explainBtn.textContent = 'Atualizar explicação com IA';
      } else {
        explainBtn.textContent = 'Explicar jogada com IA';
      }

      explainBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        goToPly(m.ply);
        requestAiExplanation(m);
      });

      actions.appendChild(explainBtn);

      const isCollapsed = Boolean(state.collapsedExplainPly[m.ply]);
      if (cachedAnswer || explainErr) {
        const collapseBtn = document.createElement('button');
        collapseBtn.type = 'button';
        collapseBtn.className = 'btn btn-collapse-ai' + (isCollapsed ? ' collapsed' : '');
        collapseBtn.title = isCollapsed ? 'Expandir análise' : 'Recolher análise';
        collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expandir análise' : 'Recolher análise');
        collapseBtn.innerHTML = UP_ARROW_SVG;
        collapseBtn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          state.collapsedExplainPly[m.ply] = !state.collapsedExplainPly[m.ply];
          renderCriticalMoments();
        });
        actions.appendChild(collapseBtn);
      }

      card.appendChild(actions);

      if (!isCollapsed) {
        if (cachedAnswer) {
          const expBox = document.createElement('div');
          expBox.className = 'ai-explanation-box';
          expBox.innerHTML = formatAiTextSafe(cachedAnswer);
          expBox.addEventListener('click', function (ev) {
            ev.stopPropagation();
          });
          card.appendChild(expBox);
        } else if (explainErr) {
          const errBox = document.createElement('div');
          errBox.className = 'ai-explanation-box error';
          errBox.textContent = explainErr;
          errBox.addEventListener('click', function (ev) {
            ev.stopPropagation();
          });
          card.appendChild(errBox);
        }
      }

      card.addEventListener('click', function () {
        goToPly(m.ply);
      });

      frag.appendChild(card);
    });

    els.criticalMomentsList.innerHTML = '';
    els.criticalMomentsList.appendChild(frag);
  }

  async function requestAiExplanation(moment) {
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
    renderCriticalMoments();

    try {
      const answer = await ChessApp.ai.explainCriticalMove(moment, state.gameId);
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
      renderCriticalMoments();
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
    state.criticalMoments = [];
    state.criticalByPly = {};
    state.badgeMap = {};

    els.btnDeepAnalysis.disabled = true;
    els.analysisProgressBar.style.width = '0%';
    els.analysisStatusText.textContent =
      (isDeep ? 'Análise profunda' : 'Análise rápida') +
      ' (profundidade ' +
      depth +
      '): iniciando Stockfish...';

    renderMovesList();
    renderCriticalMoments();
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
        state.criticalMoments = result.moments;
        state.badgeMap = result.badgeMap;
        state.criticalByPly = {};
        result.moments.forEach(function (m) {
          state.criticalByPly[m.ply] = m;
        });

        els.analysisProgressBar.style.width = '100%';
        if (result.depth >= DEEP_DEPTH) {
          els.analysisStatusText.textContent =
            'Análise profunda concluída (profundidade ' + result.depth + ').';
          els.btnDeepAnalysis.disabled = true;
        } else {
          els.analysisStatusText.textContent =
            'Análise rápida concluída (profundidade ' +
            result.depth +
            '). Encontramos ' +
            result.moments.length +
            ' momento(s) crítico(s).';
          els.btnDeepAnalysis.disabled = false;
        }

        renderMovesList();
        renderCriticalMoments();
        renderCurrentPosition();
      },
      onError: function (err) {
        state.isAnalyzing = false;
        els.btnDeepAnalysis.disabled = false;
        els.analysisStatusText.textContent = err.message || 'Erro ao executar o Stockfish.';
        renderCriticalMoments();
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
    state.currentPly = parsed.positions.length - 1;
    state.evals = new Array(parsed.positions.length).fill(null);
    state.bestMoves = new Array(parsed.positions.length).fill(null);
    state.criticalMoments = [];
    state.criticalByPly = {};
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

  async function handleChessComSearch(e) {
    e.preventDefault();
    const username = els.chesscomUsername.value.trim();
    if (!username) {
      showLoaderFeedback('Digite o nome de usuário do Chess.com para buscar.', 'error');
      return;
    }

    els.btnFetchChesscom.disabled = true;
    els.btnFetchChesscom.textContent = 'Buscando...';
    showLoaderFeedback('Buscando partidas recentes de "' + username + '" no Chess.com...', '');

    try {
      const games = await ChessApp.chesscom.fetchRecentGames(username, 20);
      state.recentGames = games;
      state.activeRecentGameId = games[0].id;
      renderRecentGamesList(games[0].userName || username);

      loadGameFromPgn(games[0].pgn, {
        gameId: games[0].id,
        orientation: games[0].userColor
      });

      showLoaderFeedback(
        'Última partida de ' +
          (games[0].userName || username) +
          ' carregada. Você também pode escolher entre as ' +
          games.length +
          ' partidas listadas abaixo.',
        'success'
      );
    } catch (err) {
      showLoaderFeedback(err.message || 'Erro ao buscar partidas.', 'error');
    } finally {
      els.btnFetchChesscom.disabled = false;
      els.btnFetchChesscom.textContent = 'Buscar partidas';
    }
  }

  function handleLoadPgnClick() {
    const text = els.pgnInput.value.trim();
    if (!text) {
      showLoaderFeedback('Cole o texto PGN da partida antes de clicar em carregar.', 'error');
      return;
    }
    try {
      state.activeRecentGameId = null;
      loadGameFromPgn(text, { orientation: 'white' });
      showLoaderFeedback('PGN carregado com sucesso. Analisando os lances...', 'success');
    } catch (err) {
      showLoaderFeedback(err.message, 'error');
    }
  }

  function handleLoadSample() {
    els.pgnInput.value = SAMPLE_PGN;
    state.activeRecentGameId = null;
    try {
      loadGameFromPgn(SAMPLE_PGN, {
        gameId: 'sample-game',
        orientation: 'white'
      });
      showLoaderFeedback(
        'Partida de exemplo carregada. Veja o Stockfish detectar os erros automaticamente.',
        'success'
      );
    } catch (err) {
      showLoaderFeedback(err.message, 'error');
    }
  }

  function refreshAiStatusBadge() {
    const settings = ChessApp.ai.getSettings();
    const key = ChessApp.ai.getActiveKey(settings);
    if (key) {
      const label = settings.provider === 'groq' ? 'Groq ativo' : 'Gemini ativo';
      els.aiStatusBadge.textContent = label;
      els.aiStatusBadge.className = 'status-pill status-pill-on';
    } else {
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
    els.btnLoadSample.addEventListener('click', handleLoadSample);
    els.btnLoadSamplePgn.addEventListener('click', handleLoadSample);

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
    cacheDom();
    bindEvents();
    refreshAiStatusBadge();
    resetChatForCurrentPly();
    updatePlayerBars();
    renderCurrentPosition();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
