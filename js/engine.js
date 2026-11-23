(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  let worker = null;
  let currentRunId = 0;

  let chatWorker = null;
  let chatInitPromise = null;
  let chatQueue = Promise.resolve();

  function terminateWorker() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  function createFreshWorker() {
    terminateWorker();
    if (global.location && global.location.protocol === 'file:') {
      throw new Error(
        'Web Workers são bloqueados no modo file://. Abra o site usando abrir-site.bat.'
      );
    }
    worker = new Worker('./vendor/stockfish.js');
    return worker;
  }

  function initWorker(w) {
    return new Promise(function (resolve, reject) {
      let uciOk = false;
      const timer = setTimeout(function () {
        reject(new Error('O motor Stockfish demorou muito para iniciar.'));
      }, 15000);

      function onMessage(e) {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line === 'uciok') {
          uciOk = true;
          w.postMessage('setoption name Contempt value 0');
          w.postMessage('setoption name Analysis Contempt value Off');
          w.postMessage('setoption name UCI_AnalyseMode value true');
          w.postMessage('isready');
        } else if (line === 'readyok' && uciOk) {
          clearTimeout(timer);
          w.removeEventListener('message', onMessage);
          w.removeEventListener('error', onError);
          resolve();
        }
      }

      function onError(err) {
        clearTimeout(timer);
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        reject(new Error('Erro ao carregar o motor Stockfish: ' + (err.message || 'desconhecido')));
      }

      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage('uci');
    });
  }

  function ensureChatWorker() {
    if (chatWorker && chatInitPromise) {
      return chatInitPromise;
    }
    if (global.location && global.location.protocol === 'file:') {
      return Promise.reject(
        new Error('Web Workers são bloqueados no modo file://. Abra o site usando abrir-site.bat.')
      );
    }
    chatWorker = new Worker('./vendor/stockfish.js');
    chatInitPromise = initWorker(chatWorker)
      .then(function () {
        return chatWorker;
      })
      .catch(function (err) {
        if (chatWorker) {
          chatWorker.terminate();
          chatWorker = null;
        }
        chatInitPromise = null;
        throw err;
      });
    return chatInitPromise;
  }

  function waitForReady(w) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        w.removeEventListener('message', onMsg);
        reject(new Error('Stockfish não respondeu a tempo.'));
      }, 10000);

      function onMsg(e) {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line === 'readyok') {
          clearTimeout(timer);
          w.removeEventListener('message', onMsg);
          resolve();
        }
      }

      w.addEventListener('message', onMsg);
      w.postMessage('isready');
    });
  }

  function parseScoreLine(line, turn) {
    const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
    if (mateMatch) {
      let val = parseInt(mateMatch[1], 10);
      if (turn === 'b') val = -val;
      return { type: 'mate', value: val };
    }

    const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
    if (cpMatch) {
      let val = parseInt(cpMatch[1], 10);
      if (turn === 'b') val = -val;
      return { type: 'cp', value: val };
    }

    return null;
  }

  function checkTerminalPosition(fen, turn) {
    if (typeof global.Chess !== 'function') return null;
    const checker = new global.Chess(fen);
    if (checker.in_checkmate()) {
      return {
        terminal: 'checkmate',
        evalObj: { type: 'mate', value: turn === 'w' ? -1 : 1, terminal: true },
        bestMoveUci: null
      };
    }
    if (checker.in_draw() || checker.in_stalemate() || checker.insufficient_material()) {
      return {
        terminal: 'draw',
        evalObj: { type: 'cp', value: 0 },
        bestMoveUci: null
      };
    }
    return null;
  }

  function evaluatePosition(w, fen, turn, depth, runId) {
    return new Promise(function (resolve, reject) {
      if (runId !== currentRunId) {
        resolve(null);
        return;
      }

      const terminal = checkTerminalPosition(fen, turn);
      if (terminal) {
        resolve({ evalObj: terminal.evalObj, bestMoveUci: null });
        return;
      }

      let latestEval = { type: 'cp', value: 0 };
      let finished = false;

      const timeoutId = setTimeout(function () {
        if (!finished) {
          finished = true;
          w.removeEventListener('message', onMsg);
          w.removeEventListener('error', onErr);
          resolve({ evalObj: latestEval, bestMoveUci: null });
        }
      }, 20000);

      function cleanup() {
        clearTimeout(timeoutId);
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
      }

      function onMsg(e) {
        if (runId !== currentRunId) {
          if (!finished) {
            finished = true;
            cleanup();
            resolve(null);
          }
          return;
        }

        const line = typeof e.data === 'string' ? e.data : '';
        if (line.indexOf('info ') === 0 && line.indexOf(' score ') !== -1) {
          const isBound =
            line.indexOf(' lowerbound') !== -1 || line.indexOf(' upperbound') !== -1;
          const parsed = parseScoreLine(line, turn);
          if (parsed && !isBound) {
            latestEval = parsed;
          }
        } else if (line.indexOf('bestmove ') === 0) {
          if (!finished) {
            finished = true;
            cleanup();
            const parts = line.split(/\s+/);
            const bm = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
            resolve({ evalObj: latestEval, bestMoveUci: bm });
          }
        }
      }

      function onErr(err) {
        if (!finished) {
          finished = true;
          cleanup();
          reject(new Error('Erro no Stockfish: ' + (err.message || 'falha no worker')));
        }
      }

      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage('position fen ' + fen);
      w.postMessage('go depth ' + depth);
    });
  }

  function uciSequenceToSan(fen, uciList, maxMoves) {
    if (!Array.isArray(uciList) || uciList.length === 0 || typeof global.Chess !== 'function') {
      return { bestSan: null, from: null, to: null, bestUci: null, pvSan: [] };
    }
    const sim = new global.Chess(fen);
    const pvSan = [];
    let firstMove = null;
    const limit = Math.min(uciList.length, maxMoves || 4);

    for (let i = 0; i < limit; i += 1) {
      const uci = uciList[i];
      if (!uci || uci.length < 4) break;
      const move = sim.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined
      });
      if (!move) break;
      if (!firstMove) {
        firstMove = {
          san: move.san,
          from: move.from,
          to: move.to,
          uci: uci
        };
      }
      pvSan.push(move.san);
    }

    return {
      bestSan: firstMove ? firstMove.san : null,
      from: firstMove ? firstMove.from : null,
      to: firstMove ? firstMove.to : null,
      bestUci: firstMove ? firstMove.uci : null,
      pvSan: pvSan
    };
  }

  async function runMultiPvInternal(fen, turn, depth, multiPvCount) {
    const terminal = checkTerminalPosition(fen, turn);
    if (terminal) {
      return {
        evalObj: terminal.evalObj,
        lines: [],
        terminal: terminal.terminal
      };
    }

    const w = await ensureChatWorker();
    const pvCount = Math.max(1, Math.min(3, multiPvCount || 3));
    const searchDepth = depth || 11;

    w.postMessage('setoption name MultiPV value ' + pvCount);
    await waitForReady(w);

    return new Promise(function (resolve, reject) {
      const pvMap = {};
      let finished = false;

      const timer = setTimeout(function () {
        if (!finished) {
          finished = true;
          cleanup();
          resolve(finalizeLines());
        }
      }, 20000);

      function cleanup() {
        clearTimeout(timer);
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
      }

      function finalizeLines() {
        const ranks = Object.keys(pvMap)
          .map(Number)
          .sort(function (a, b) {
            return a - b;
          });
        const lines = ranks
          .map(function (rank) {
            const entry = pvMap[rank];
            const sanInfo = uciSequenceToSan(fen, entry.pvUcis, 4);
            if (!sanInfo.bestSan) return null;
            return {
              rank: rank,
              evalObj: entry.evalObj,
              bestUci: sanInfo.bestUci,
              bestSan: sanInfo.bestSan,
              from: sanInfo.from,
              to: sanInfo.to,
              pvSan: sanInfo.pvSan
            };
          })
          .filter(Boolean);

        return {
          evalObj: lines[0] ? lines[0].evalObj : { type: 'cp', value: 0 },
          lines: lines,
          terminal: null
        };
      }

      function onMsg(e) {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line.indexOf('info ') === 0 && line.indexOf(' score ') !== -1) {
          const isBound =
            line.indexOf(' lowerbound') !== -1 || line.indexOf(' upperbound') !== -1;
          const parsedEval = parseScoreLine(line, turn);
          if (!parsedEval) return;

          const pvIdxMatch = line.match(/\bmultipv\s+(\d+)/);
          const pvIdx = pvIdxMatch ? parseInt(pvIdxMatch[1], 10) : 1;
          const depthMatch = line.match(/\bdepth\s+(\d+)/);
          const infoDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
          const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?(?:\s+[a-h][1-8][a-h][1-8][qrbn]?)*)/);
          const pvUcis = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

          const prev = pvMap[pvIdx];
          if (!prev || !isBound || infoDepth > prev.depth) {
            if (!isBound || !prev) {
              pvMap[pvIdx] = {
                depth: infoDepth,
                evalObj: parsedEval,
                pvUcis: pvUcis.length > 0 ? pvUcis : prev ? prev.pvUcis : []
              };
            }
          }
        } else if (line.indexOf('bestmove ') === 0) {
          if (!finished) {
            finished = true;
            cleanup();
            resolve(finalizeLines());
          }
        }
      }

      function onErr(err) {
        if (!finished) {
          finished = true;
          cleanup();
          reject(new Error('Erro no Stockfish: ' + (err.message || 'falha no worker')));
        }
      }

      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage('position fen ' + fen);
      w.postMessage('go depth ' + searchDepth);
    });
  }

  function analyzePositionMultiPV(fen, turn, depth, multiPvCount) {
    const task = chatQueue.then(function () {
      return runMultiPvInternal(fen, turn, depth, multiPvCount);
    });
    chatQueue = task.catch(function () {});
    return task;
  }

  function stripSanCheck(san) {
    return (san || '').replace(/[+#?!]+$/g, '');
  }

  function ptMoveToEnCandidates(token) {
    const clean = stripSanCheck(token);
    if (!clean) return [];

    if (/^[0oO]-[0oO]-[0oO]$/.test(clean)) return ['O-O-O'];
    if (/^[0oO]-[0oO]$/.test(clean)) return ['O-O'];

    const candidates = [clean];

    // Convert promotion suffix =D/=T/=C/=B -> =Q/=R/=N/=B
    function convertPromo(str) {
      return str
        .replace(/=[Dd]$/, '=Q')
        .replace(/=[Tt]$/, '=R')
        .replace(/=[Cc]$/, '=N')
        .replace(/=[Bb]$/, '=B');
    }

    const withEnPromo = convertPromo(clean);
    if (withEnPromo !== clean) candidates.push(withEnPromo);

    const first = clean[0];
    const rest = withEnPromo.slice(1);
    const ptMap = { C: 'N', c: 'N', D: 'Q', d: 'Q', T: 'R', t: 'R', R: 'K', r: 'K', b: 'B' };
    if (ptMap[first] && rest) {
      candidates.push(ptMap[first] + rest);
    }
    return candidates;
  }

  function matchTokenToLegalMove(token, legalMoves) {
    if (!token) return null;
    const clean = stripSanCheck(token);
    if (!clean) return null;

    // 1. Exact English SAN match (castling case-insensitive)
    const castlingNorm = /^[0oO]-[0oO]-[0oO]$/.test(clean)
      ? 'O-O-O'
      : /^[0oO]-[0oO]$/.test(clean)
      ? 'O-O'
      : null;

    if (castlingNorm) {
      const castleHit = legalMoves.find(function (m) {
        return stripSanCheck(m.san) === castlingNorm;
      });
      if (castleHit) return castleHit;
    }

    const exactHit = legalMoves.find(function (m) {
      return stripSanCheck(m.san) === clean;
    });
    if (exactHit) return exactHit;

    // 2. UCI match (e.g., g1f3, e7e8q)
    const lower = clean.toLowerCase();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(lower)) {
      const uciHit = legalMoves.find(function (m) {
        return m.from + m.to + (m.promotion || '') === lower;
      });
      if (uciHit) return uciHit;
    }

    // 3. Portuguese piece prefix & promotion conversion
    const ptCandidates = ptMoveToEnCandidates(clean);
    for (let i = 0; i < ptCandidates.length; i += 1) {
      const cand = ptCandidates[i];
      // Avoid mapping lowercase pawn/word tokens like 'c5' unless it cannot be a pawn move
      const isLowerPrefix = /^[cdtrb]/.test(clean);
      if (isLowerPrefix && /^[a-h][1-8]$/.test(clean)) {
        continue;
      }
      const ptHit = legalMoves.find(function (m) {
        return stripSanCheck(m.san) === cand;
      });
      if (ptHit) return ptHit;
    }

    return null;
  }

  function looksLikeMoveSyntax(token) {
    const clean = stripSanCheck(token);
    if (!clean || clean.length < 2 || clean.length > 7) return false;
    if (/^[0oO]-[0oO](-[0oO])?$/.test(clean)) return true;
    if (/^[KQRBNCDT][a-h]?[1-8]?x?[a-h][1-8](=[QRBNCDT])?$/.test(clean)) return true;
    if (/^[a-h](x[a-h])?[1-8](=[QRBNCDT])?$/.test(clean)) return true;
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(clean)) return true;
    return false;
  }

  function tokenizeMoveText(text) {
    return String(text || '')
      .replace(/[«»"'`*()[\]{}]/g, ' ')
      .split(/\s+/)
      .map(function (t) {
        return t.replace(/^\d+\.{1,3}/, '').replace(/[,.;:!?]+$/g, '');
      })
      .filter(Boolean);
  }

  function findMovesInText(text, fen) {
    if (!text || !fen || typeof global.Chess !== 'function') return [];
    const chess = new global.Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    const found = [];
    const seen = new Set();

    const lowerText = text.toLowerCase();
    if (/roque\s+(grande|longo)/.test(lowerText)) {
      const m = matchTokenToLegalMove('O-O-O', legalMoves);
      if (m && !seen.has(m.san)) {
        seen.add(m.san);
        found.push(m);
      }
    }
    if (/roque\s+(curto|pequeno)/.test(lowerText)) {
      const m = matchTokenToLegalMove('O-O', legalMoves);
      if (m && !seen.has(m.san)) {
        seen.add(m.san);
        found.push(m);
      }
    }

    const tokens = tokenizeMoveText(text);
    tokens.forEach(function (tok) {
      const m = matchTokenToLegalMove(tok, legalMoves);
      if (m && !seen.has(m.san)) {
        seen.add(m.san);
        found.push(m);
      }
    });

    return found;
  }

  function extractAlternativeMoveFromQuestion(question, fen) {
    if (!question || !fen || typeof global.Chess !== 'function') return null;
    const chess = new global.Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    const lowerText = question.toLowerCase();
    if (/roque\s+(grande|longo)/.test(lowerText)) {
      const mLong = matchTokenToLegalMove('O-O-O', legalMoves);
      if (mLong) {
        const sim = new global.Chess(fen);
        sim.move(mLong.san);
        return {
          legal: true,
          move: mLong,
          rawToken: 'O-O-O',
          fenAfter: sim.fen(),
          turnAfter: sim.turn()
        };
      }
      return { legal: false, rawToken: 'O-O-O' };
    }
    if (/roque\s+(curto|pequeno)/.test(lowerText)) {
      const mShort = matchTokenToLegalMove('O-O', legalMoves);
      if (mShort) {
        const sim = new global.Chess(fen);
        sim.move(mShort.san);
        return {
          legal: true,
          move: mShort,
          rawToken: 'O-O',
          fenAfter: sim.fen(),
          turnAfter: sim.turn()
        };
      }
      return { legal: false, rawToken: 'O-O' };
    }

    const tokens = tokenizeMoveText(question);
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      const hit = matchTokenToLegalMove(tok, legalMoves);
      if (hit) {
        const sim = new global.Chess(fen);
        sim.move(hit.san);
        return {
          legal: true,
          move: hit,
          rawToken: tok,
          fenAfter: sim.fen(),
          turnAfter: sim.turn()
        };
      }
    }

    for (let i = 0; i < tokens.length; i += 1) {
      if (looksLikeMoveSyntax(tokens[i])) {
        return { legal: false, rawToken: tokens[i] };
      }
    }

    return null;
  }

  async function analyzeForChat(fen, turn, question) {
    const current = await analyzePositionMultiPV(fen, turn, 11, 3);
    const altCandidate = extractAlternativeMoveFromQuestion(question, fen);

    if (!altCandidate) {
      return { current: current, alternative: null };
    }

    if (!altCandidate.legal) {
      return {
        current: current,
        alternative: {
          legal: false,
          rawToken: altCandidate.rawToken
        }
      };
    }

    const afterAlt = await analyzePositionMultiPV(
      altCandidate.fenAfter,
      altCandidate.turnAfter,
      11,
      1
    );

    const bestReply = afterAlt.lines && afterAlt.lines[0] ? afterAlt.lines[0] : null;
    return {
      current: current,
      alternative: {
        legal: true,
        rawToken: altCandidate.rawToken,
        san: altCandidate.move.san,
        from: altCandidate.move.from,
        to: altCandidate.move.to,
        evalAfter: afterAlt.evalObj,
        terminal: afterAlt.terminal,
        replySan: bestReply ? bestReply.bestSan : null,
        replyFrom: bestReply ? bestReply.from : null,
        replyTo: bestReply ? bestReply.to : null,
        pvSan: bestReply ? bestReply.pvSan : []
      }
    };
  }

  function classifyMove(winDrop, isEngineBest) {
    if (winDrop >= 18) {
      return { key: 'capivara', label: 'Capivara', symbol: '??' };
    }
    if (winDrop >= 9) {
      return { key: 'erro', label: 'Erro', symbol: '?' };
    }
    if (winDrop >= 5) {
      return { key: 'imprecisao', label: 'Imprecisão', symbol: '?!' };
    }
    if (isEngineBest || winDrop < 1) {
      return { key: 'melhor', label: 'Melhor', symbol: '' };
    }
    return { key: 'bom', label: 'Bom', symbol: '' };
  }

  function computeMoveAccuracy(winDrop) {
    if (winDrop <= 0) return 100;
    const acc = 103.1668 * Math.exp(-0.04354 * winDrop) - 3.1669;
    return Math.max(0, Math.min(100, acc));
  }

  function uciToMoveDetails(fen, uci) {
    if (!uci || uci.length < 4 || typeof global.Chess !== 'function') {
      return { san: uci || '-', from: null, to: null };
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const temp = new global.Chess(fen);
    const moveObj = temp.move({ from: from, to: to, promotion: promotion });
    return {
      san: moveObj ? moveObj.san : uci,
      from: from,
      to: to
    };
  }

  function buildGameReview(positions, evals, bestMoves) {
    const winProb = ChessApp.board.winProbabilityWhite;
    const allReviews = [];
    const reviewsByPly = {};
    const badgeMap = {};

    for (let ply = 1; ply < positions.length; ply += 1) {
      const posBefore = positions[ply - 1];
      const posAfter = positions[ply];
      const evalBefore = evals[ply - 1] || { type: 'cp', value: 0 };
      const evalAfter = evals[ply] || { type: 'cp', value: 0 };
      const bestUci = bestMoves[ply - 1] || null;

      const pBefore = winProb(evalBefore);
      const pAfter = winProb(evalAfter);
      const mover = posBefore.turn;
      const rawDrop = mover === 'w' ? pBefore - pAfter : pAfter - pBefore;
      const winDrop = Math.max(0, rawDrop);
      const isEngineBest = Boolean(!bestUci || (posAfter.uci && posAfter.uci === bestUci));

      const severity = classifyMove(winDrop, isEngineBest);
      const bestDetails = bestUci
        ? uciToMoveDetails(posBefore.fen, bestUci)
        : { san: posAfter.san, from: posAfter.from, to: posAfter.to };

      const review = {
        ply: ply,
        moveNumber: posAfter.moveNumber,
        moverColor: mover,
        playedSan: posAfter.san,
        playedFrom: posAfter.from,
        playedTo: posAfter.to,
        playedUci: posAfter.uci,
        bestSan: bestDetails.san,
        bestFrom: bestDetails.from,
        bestTo: bestDetails.to,
        bestUci: bestUci,
        fenBefore: posBefore.fen,
        evalBefore: evalBefore,
        evalAfter: evalAfter,
        winDrop: winDrop,
        accuracy: computeMoveAccuracy(winDrop),
        severity: severity,
        isMistake: winDrop >= 5,
        isCritical: false
      };

      allReviews.push(review);
      reviewsByPly[ply] = review;
      if (review.isMistake) {
        badgeMap[ply] = severity;
      }
    }

    ['w', 'b'].forEach(function (color) {
      allReviews
        .filter(function (r) {
          return r.moverColor === color && r.isMistake;
        })
        .sort(function (a, b) {
          return b.winDrop - a.winDrop;
        })
        .slice(0, 5)
        .forEach(function (r) {
          r.isCritical = true;
        });
    });

    return {
      allReviews: allReviews,
      reviewsByPly: reviewsByPly,
      badgeMap: badgeMap
    };
  }

  async function analyzeGame(positions, depth, callbacks) {
    currentRunId += 1;
    const myRunId = currentRunId;
    const onProgress = (callbacks && callbacks.onProgress) || function () {};
    const onComplete = (callbacks && callbacks.onComplete) || function () {};
    const onError = (callbacks && callbacks.onError) || function () {};

    let w;
    try {
      w = createFreshWorker();
      await initWorker(w);
    } catch (err) {
      if (myRunId === currentRunId) {
        onError(err);
      }
      return;
    }

    if (myRunId !== currentRunId) return;

    const total = positions.length;
    const evals = new Array(total).fill(null);
    const bestMoves = new Array(total).fill(null);

    try {
      for (let i = 0; i < total; i += 1) {
        if (myRunId !== currentRunId) return;

        const pos = positions[i];
        const res = await evaluatePosition(w, pos.fen, pos.turn, depth, myRunId);
        if (!res || myRunId !== currentRunId) return;

        evals[i] = res.evalObj;
        bestMoves[i] = res.bestMoveUci;

        onProgress({
          completed: i + 1,
          total: total,
          ply: i,
          evals: evals,
          bestMoves: bestMoves
        });
      }

      if (myRunId !== currentRunId) return;
      const result = buildGameReview(positions, evals, bestMoves);
      onComplete({
        evals: evals,
        bestMoves: bestMoves,
        allReviews: result.allReviews,
        reviewsByPly: result.reviewsByPly,
        badgeMap: result.badgeMap,
        depth: depth
      });
    } catch (err) {
      if (myRunId === currentRunId) {
        onError(err);
      }
    }
  }

  function cancelAnalysis() {
    currentRunId += 1;
    terminateWorker();
  }

  ChessApp.engine = {
    analyzeGame,
    cancelAnalysis,
    analyzePositionMultiPV,
    extractAlternativeMoveFromQuestion,
    findMovesInText,
    analyzeForChat
  };
})(window);
