/* QUN ID shared browser authentication.
 * Uses the existing server-side qun-auth endpoint; never authenticates by trusting a username alone.
 * The publishable Supabase key is public by design. Provider secrets remain server-side.
 */
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://qdxjltqlnphvzafapncm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L';
  const ENDPOINT = SUPABASE_URL + '/functions/v1/qun-auth';

  async function request(client, payload) {
    if (!client || !payload || typeof payload.action !== 'string') {
      throw new Error('Не удалось подготовить запрос QUN ID.');
    }
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос QUN ID.');
    if (!data.session || !data.session.access_token || !data.session.refresh_token) {
      throw new Error('Сервер QUN ID не вернул действующую сессию. Попробуйте ещё раз.');
    }
    const { data: authData, error } = await client.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
    if (error) throw error;
    return Object.assign({}, data, { authSession: authData.session });
  }

  function cleanLogin(value) {
    return String(value || '').trim().replace(/^@/, '').toLowerCase();
  }

  async function login(client, login, password) {
    const identifier = cleanLogin(login);
    if (!identifier || !password) throw new Error('Введите QUN ID и пароль.');

    // Compatibility: keep older email/password accounts usable while QUN ID becomes the default.
    if (identifier.includes('@')) {
      const { data, error } = await client.auth.signInWithPassword({
        email: identifier,
        password
      });
      if (!error && data.session) {
        return {
          user: data.user,
          session: data.session,
          authSession: data.session,
          legacyEmailLogin: true
        };
      }
      if (error) throw error;
    }

    return request(client, { action: 'login', login: identifier, password });
  }

  async function register(client, options) {
    const username = cleanLogin(options && options.username);
    const display_name = String((options && options.display_name) || username).trim().slice(0, 100);
    const phone = String((options && options.phone) || '').trim();
    const password = String((options && options.password) || '');
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new Error('QUN ID: от 3 до 24 символов — латинские буквы, цифры и _.');
    }
    if (password.length < 8) throw new Error('Пароль должен содержать не менее 8 символов.');
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Проверьте номер телефона или оставьте поле пустым.');
    return request(client, { action: 'register', username, display_name, phone, password });
  }

  async function claimLegacy(client, username, claim_code, password) {
    return request(client, {
      action: 'claim_legacy',
      username: cleanLogin(username),
      claim_code: String(claim_code || '').trim().toLowerCase(),
      password: String(password || '')
    });
  }

  global.QUNAuth = Object.freeze({ request, login, register, claimLegacy, cleanLogin });
})(window);
