(function (global) {
  'use strict';

  const ChessApp = (global.ChessApp = global.ChessApp || {});

  const STORAGE_KEY = 'xadrez_analise_settings';
  const SETTINGS_VERSION = 2;

  const PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      models: [
        {
          id: 'gemini-3.5-flash-lite',
          label: 'Gemini 3.5 Flash-Lite (Recomendado)'
        },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Alternativa)' },
        { id: 'gemini-3-flash', label: 'Gemini 3 Flash (Alternativa)' }
      ]
    },
    groq: {
      name: 'Groq',
      models: [
        { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Recomendado)' },
        { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Alternativa)' }
      ]
    }
  };

  const DEFAULT_SETTINGS = {
    settingsVersion: SETTINGS_VERSION,
    provider: 'gemini',
    geminiKey: '',
    groqKey: '',
    geminiModel: 'gemini-3.5-flash-lite',
    groqModel: 'qwen/qwen3.8-27b'
  };

  const DEPRECATED_GEMINI_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.0-flash']);
  const cache = new Map();

  function isDeprecatedGroqModel(modelId) {
    return (
      modelId === 'llama-3.3-70b-versatile' ||
      (typeof modelId === 'string' && modelId.indexOf('openai/gpt-oss') === 0)
    );
  }

  function getSettings() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      const parsed = JSON.parse(raw);
      const merged = Object.assign({}, DEFAULT_SETTINGS, parsed || {});
      let migrated = false;

      if (!parsed || !parsed.settingsVersion || parsed.settingsVersion < SETTINGS_VERSION) {
        if (
          DEPRECATED_GEMINI_MODELS.has(merged.geminiModel) ||
          merged.geminiModel === 'gemini-3.8-flash'
        ) {
          merged.geminiModel = DEFAULT_SETTINGS.geminiModel;
          migrated = true;
        }
        if (isDeprecatedGroqModel(merged.groqModel)) {
          merged.groqModel = DEFAULT_SETTINGS.groqModel;
          migrated = true;
        }
        merged.settingsVersion = SETTINGS_VERSION;
        migrated = true;
      } else {
        if (DEPRECATED_GEMINI_MODELS.has(merged.geminiModel)) {
          merged.geminiModel = DEFAULT_SETTINGS.geminiModel;
          migrated = true;
        }
        if (isDeprecatedGroqModel(merged.groqModel)) {
          merged.groqModel = DEFAULT_SETTINGS.groqModel;
          migrated = true;
        }
      }

      if (migrated) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(next) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, next || {}, {
      settingsVersion: SETTINGS_VERSION
    });
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function clearSettings() {
    global.localStorage.removeItem(STORAGE_KEY);
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function getActiveKey(settings) {
    const s = settings || getSettings();
    return s.provider === 'groq' ? (s.groqKey || '').trim() : (s.geminiKey || '').trim();
  }

  function getActiveModel(settings) {
    const s = settings || getSettings();
    return s.provider === 'groq' ? s.groqModel : s.geminiModel;
  }

  function buildPrompt(moment) {
    const colorLabel = moment.moverColor === 'w' ? 'Brancas' : 'Pretas';
    const evalBeforeStr = ChessApp.board.formatEvalScore(moment.evalBefore);
    const evalAfterStr = ChessApp.board.formatEvalScore(moment.evalAfter);
    const key = moment.severity && moment.severity.key;
    const isMistake = key === 'capivara' || key === 'erro' || key === 'imprecisao';

    const baseInfo =
      'Você é um analista de xadrez objetivo explicando em português do Brasil.\n' +
      '- Posição (FEN antes do lance): ' +
      moment.fenBefore +
      '\n' +
      '- Lado que jogou: ' +
      colorLabel +
      ' (lance ' +
      moment.moveNumber +
      ')\n' +
      '- Lance jogado: ' +
      moment.playedSan +
      ' (' +
      moment.severity.label +
      ')\n' +
      '- Melhor lance segundo o Stockfish: ' +
      moment.bestSan +
      '\n' +
      '- Avaliação (visão das Brancas): foi de ' +
      evalBeforeStr +
      ' para ' +
      evalAfterStr +
      '\n\n';

    if (isMistake) {
      return (
        baseInfo +
        'Responda EXATAMENTE com estes 2 tópicos curtos, diretos e objetivos, sem saudações, sem introdução e sem dicas genéricas:\n' +
        '**Por que foi um erro:** explique em 1 a 2 frases diretas qual problema tático ou posicional concreto o lance ' +
        moment.playedSan +
        ' causou.\n\n' +
        '**Por que o melhor lance funciona:** explique em 1 a 2 frases diretas o motivo objetivo de ' +
        moment.bestSan +
        ' ser melhor.'
      );
    }

    if (moment.bestSan && moment.bestSan !== moment.playedSan) {
      return (
        baseInfo +
        'Responda EXATAMENTE com estes 2 tópicos curtos, diretos e objetivos, sem saudações, sem introdução e sem dicas genéricas:\n' +
        '**Por que o lance funciona:** explique em 1 a 2 frases diretas a ideia tática ou posicional de ' +
        moment.playedSan +
        '.\n\n' +
        '**Alternativa do motor:** explique em 1 frase curta a diferença objetiva para ' +
        moment.bestSan +
        '.'
      );
    }

    return (
      baseInfo +
      'Responda EXATAMENTE com este tópico curto, direto e objetivo, sem saudações, sem introdução e sem dicas genéricas:\n' +
      '**Por que foi o melhor lance:** explique em 1 a 2 frases diretas a ideia tática ou posicional que torna ' +
      moment.playedSan +
      ' forte nesta posição.'
    );
  }

  async function buildHttpError(provider, resp) {
    let detail = '';
    try {
      const errJson = await resp.json();
      detail = (errJson && errJson.error && errJson.error.message) || '';
    } catch (e) {}

    let message;
    if (provider === 'gemini') {
      if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
        message =
          'Chave do Google Gemini inválida ou sem permissão. Confira em Configurar IA.' +
          (detail ? ' (' + detail + ')' : '');
      } else if (resp.status === 429) {
        message =
          'Limite gratuito temporário do Gemini atingido. Aguarde alguns segundos ou tente usar a Groq.';
      } else {
        message = 'Erro na API do Gemini (código ' + resp.status + '). ' + detail;
      }
    } else {
      if (resp.status === 401 || resp.status === 403) {
        message =
          'Chave da Groq inválida ou revogada. Confira em Configurar IA.' +
          (detail ? ' (' + detail + ')' : '');
      } else if (resp.status === 429) {
        message =
          'Limite gratuito por minuto da Groq atingido. Aguarde um pouco e tente novamente.';
      } else {
        message = 'Erro na API da Groq (código ' + resp.status + '). ' + detail;
      }
    }

    const err = new Error(message);
    err.status = resp.status;
    return err;
  }

  async function callGeminiPayload(apiKey, model, payload) {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw await buildHttpError('gemini', resp);
    }

    const data = await resp.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      throw new Error('O Gemini retornou uma resposta vazia. Tente novamente.');
    }
    return text.trim();
  }

  async function callGroqPayload(apiKey, model, payload) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw await buildHttpError('groq', resp);
    }

    const data = await resp.json();
    const text =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!text) {
      throw new Error('A Groq retornou uma resposta vazia. Tente novamente.');
    }
    return text.trim();
  }

  function callGemini(apiKey, model, prompt) {
    return callGeminiPayload(apiKey, model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    });
  }

  function callGroq(apiKey, model, prompt) {
    return callGroqPayload(apiKey, model, {
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'Você é um analista de xadrez objetivo. Responda em português brasileiro direto ao ponto, sem saudações e sem dicas genéricas.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });
  }

  function callGeminiChat(apiKey, model, systemContext, messages) {
    const contents = messages.map(function (m) {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });
    return callGeminiPayload(apiKey, model, {
      systemInstruction: { parts: [{ text: systemContext }] },
      contents: contents,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 500
      }
    });
  }

  function callGroqChat(apiKey, model, systemContext, messages) {
    const apiMessages = [{ role: 'system', content: systemContext }].concat(
      messages.map(function (m) {
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        };
      })
    );
    return callGroqPayload(apiKey, model, {
      model: model,
      messages: apiMessages,
      temperature: 0.25,
      max_tokens: 500
    });
  }

  function scoreGeminiModel(id) {
    if (/3\.5-flash-lite/i.test(id)) return 300;
    let score = 0;
    if (/flash-lite/i.test(id)) score += 130;
    if (/flash/i.test(id)) score += 100;
    if (/pro/i.test(id)) score += 20;
    if (/preview|exp/i.test(id)) score -= 10;
    const ver = id.match(/gemini-(\d+(?:\.\d+)?)/i);
    if (ver) score += parseFloat(ver[1]) * 10;
    return score;
  }

  async function discoverGeminiModels(apiKey) {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models?key=' +
      encodeURIComponent(apiKey);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error('Não foi possível listar modelos do Gemini (código ' + resp.status + ').');
    }
    const data = await resp.json();
    const excludeRe = /embedding|imagen|veo|aqa|tts|live/i;
    const models = (data && Array.isArray(data.models) ? data.models : [])
      .filter(function (m) {
        const methods = m && m.supportedGenerationMethods;
        return (
          m &&
          typeof m.name === 'string' &&
          m.name.indexOf('models/gemini') === 0 &&
          !excludeRe.test(m.name) &&
          Array.isArray(methods) &&
          methods.indexOf('generateContent') !== -1
        );
      })
      .map(function (m) {
        const id = m.name.replace(/^models\//, '');
        return {
          id: id,
          label: m.displayName ? m.displayName + ' (' + id + ')' : id
        };
      });

    models.sort(function (a, b) {
      return scoreGeminiModel(b.id) - scoreGeminiModel(a.id);
    });
    return models;
  }

  function scoreGroqModel(id) {
    if (id === 'qwen/qwen3.8-27b') return 120;
    if (/qwen/i.test(id)) return 100;
    if (/^llama-3\./i.test(id) || /llama/i.test(id)) return 80;
    return 10;
  }

  async function discoverGroqModels(apiKey) {
    const resp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: 'Bearer ' + apiKey }
    });
    if (!resp.ok) {
      throw new Error('Não foi possível listar modelos da Groq (código ' + resp.status + ').');
    }
    const data = await resp.json();
    const excludeRe = /whisper|tts|guard|safeguard|embed|audio|playai|orpheus|compound|gpt-oss/i;
    const models = (data && Array.isArray(data.data) ? data.data : [])
      .filter(function (m) {
        return m && typeof m.id === 'string' && !excludeRe.test(m.id);
      })
      .map(function (m) {
        return { id: m.id, label: m.id };
      });

    models.sort(function (a, b) {
      return scoreGroqModel(b.id) - scoreGroqModel(a.id);
    });
    return models;
  }

  async function fetchAvailableModels(provider, apiKey) {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      throw new Error('Cole sua chave da API antes de detectar os modelos disponíveis.');
    }
    if (provider === 'groq') {
      return discoverGroqModels(cleanKey);
    }
    return discoverGeminiModels(cleanKey);
  }

  async function callWith404Fallback(settings, apiKey, invokeFn) {
    let model = getActiveModel(settings);
    try {
      const text = await invokeFn(model);
      return { text: text, model: model };
    } catch (err) {
      if (err && err.status === 404) {
        let discovered = [];
        try {
          discovered = await fetchAvailableModels(settings.provider, apiKey);
        } catch (discoverErr) {
          throw err;
        }
        const fallback = discovered.find(function (m) {
          return m.id !== model;
        });
        if (!fallback) {
          throw err;
        }
        model = fallback.id;
        if (settings.provider === 'groq') {
          settings.groqModel = model;
        } else {
          settings.geminiModel = model;
        }
        saveSettings(settings);
        try {
          const retryText = await invokeFn(model);
          return { text: retryText, model: model };
        } catch (retryErr) {
          if (retryErr.name === 'TypeError') {
            throw new Error('Falha de rede ao chamar a IA. Verifique sua conexão com a internet.');
          }
          throw retryErr;
        }
      }
      if (err.name === 'TypeError') {
        throw new Error('Falha de rede ao chamar a IA. Verifique sua conexão com a internet.');
      }
      throw err;
    }
  }

  async function explainCriticalMove(moment, gameId) {
    const settings = getSettings();
    const apiKey = getActiveKey(settings);
    if (!apiKey) {
      const err = new Error('NO_API_KEY');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const initialModel = getActiveModel(settings);
    const cacheKey = [gameId || 'game', moment.ply, settings.provider, initialModel].join('|');
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const prompt = buildPrompt(moment);
    const res = await callWith404Fallback(settings, apiKey, function (model) {
      return settings.provider === 'groq'
        ? callGroq(apiKey, model, prompt)
        : callGemini(apiKey, model, prompt);
    });

    const finalCacheKey = [gameId || 'game', moment.ply, settings.provider, res.model].join('|');
    cache.set(finalCacheKey, res.text);
    return res.text;
  }

  async function askPositionChat(params) {
    const settings = getSettings();
    const apiKey = getActiveKey(settings);
    if (!apiKey) {
      const err = new Error('NO_API_KEY');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const systemContext = (params && params.systemContext) || '';
    const rawMessages = (params && Array.isArray(params.messages) ? params.messages : []).slice(-6);

    const res = await callWith404Fallback(settings, apiKey, function (model) {
      return settings.provider === 'groq'
        ? callGroqChat(apiKey, model, systemContext, rawMessages)
        : callGeminiChat(apiKey, model, systemContext, rawMessages);
    });

    return res.text;
  }

  ChessApp.ai = {
    PROVIDERS,
    getSettings,
    saveSettings,
    clearSettings,
    getActiveKey,
    getActiveModel,
    fetchAvailableModels,
    explainCriticalMove,
    askPositionChat
  };
})(window);
