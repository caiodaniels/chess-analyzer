(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const TIME_CLASS_LABELS = {
    bullet: 'Bullet',
    blitz: 'Blitz',
    rapid: 'Rápida',
    daily: 'Diária'
  };

  function classifyResult(resultCode) {
    if (resultCode === 'win') {
      return { label: 'Vitória', css: 'res-win' };
    }
    const drawCodes = new Set([
      'agreed',
      'repetition',
      'stalemate',
      'insufficient',
      '50move',
      'timevsinsufficient'
    ]);
    if (drawCodes.has(resultCode)) {
      return { label: 'Empate', css: 'res-draw' };
    }
    return { label: 'Derrota', css: 'res-loss' };
  }

  function formatDatePt(unixSeconds) {
    if (!unixSeconds) return '';
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  function normalizeGame(rawGame, searchedUsernameLower) {
    const white = rawGame.white || {};
    const black = rawGame.black || {};
    const whiteUser = (white.username || '').toLowerCase();
    const isWhite = whiteUser === searchedUsernameLower;

    const userSide = isWhite ? white : black;
    const oppSide = isWhite ? black : white;
    const res = classifyResult(userSide.result);

    return {
      id: rawGame.url || String(rawGame.end_time) + '-' + (oppSide.username || ''),
      url: rawGame.url || '',
      pgn: rawGame.pgn,
      endTime: rawGame.end_time || 0,
      dateStr: formatDatePt(rawGame.end_time),
      timeClass: TIME_CLASS_LABELS[rawGame.time_class] || rawGame.time_class || 'Clássica',
      userColor: isWhite ? 'white' : 'black',
      userName: userSide.username || searchedUsernameLower,
      userRating: userSide.rating || '',
      opponent: oppSide.username || 'Adversário',
      opponentRating: oppSide.rating || '',
      resultLabel: res.label,
      resultCss: res.css,
      whiteName: white.username || 'Brancas',
      whiteRating: white.rating || '',
      blackName: black.username || 'Pretas',
      blackRating: black.rating || ''
    };
  }

  async function fetchRecentGames(username, limit) {
    const cleanName = (username || '').trim().toLowerCase();
    if (!cleanName) {
      throw new Error('Digite um nome de usuário do Chess.com.');
    }

    const maxGames = limit || 20;
    const archivesUrl =
      'https://api.chess.com/pub/player/' + encodeURIComponent(cleanName) + '/games/archives';

    let archivesResp;
    try {
      archivesResp = await fetch(archivesUrl);
    } catch (err) {
      throw new Error('Não foi possível conectar ao Chess.com. Verifique sua internet.');
    }

    if (archivesResp.status === 404) {
      throw new Error('Usuário "' + username.trim() + '" não encontrado no Chess.com.');
    }
    if (!archivesResp.ok) {
      throw new Error('Erro ao consultar a API do Chess.com (código ' + archivesResp.status + ').');
    }

    const archivesData = await archivesResp.json();
    const archives = Array.isArray(archivesData.archives) ? archivesData.archives : [];

    if (archives.length === 0) {
      throw new Error('Nenhuma partida pública encontrada para esse usuário.');
    }

    const collected = [];
    const maxArchivesToCheck = 3;

    for (
      let i = archives.length - 1;
      i >= 0 && archives.length - 1 - i < maxArchivesToCheck && collected.length < maxGames;
      i -= 1
    ) {
      const monthUrl = archives[i];
      if (typeof monthUrl !== 'string' || monthUrl.indexOf('https://api.chess.com/') !== 0) {
        continue;
      }
      const monthResp = await fetch(monthUrl);
      if (!monthResp.ok) continue;

      const monthData = await monthResp.json();
      const games = Array.isArray(monthData.games) ? monthData.games : [];

      for (let j = games.length - 1; j >= 0; j -= 1) {
        const g = games[j];
        if (g && g.pgn && (!g.rules || g.rules === 'chess')) {
          collected.push(normalizeGame(g, cleanName));
          if (collected.length >= maxGames) break;
        }
      }
    }

    collected.sort(function (a, b) {
      return (b.endTime || 0) - (a.endTime || 0);
    });

    if (collected.length === 0) {
      throw new Error(
        'Não encontramos partidas tradicionais (regras padrão) com PGN recente para esse usuário.'
      );
    }

    return collected.slice(0, maxGames);
  }

  ChessApp.chesscom = {
    fetchRecentGames
  };
})(window);
