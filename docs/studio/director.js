import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const db = createClient(
  'https://qdxjltqlnphvzafapncm.supabase.co',
  'sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L'
);
const $ = id => document.getElementById(id);
let film = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return String(item ?? '');
      const speaker = item.speaker || item.character || item.name || item.persona || '';
      const line = item.text || item.line || item.dialogue || item.content || '';
      return [speaker, line].filter(Boolean).join(': ');
    }).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return '';
}

function parseFilm(raw) {
  const text = String(raw ?? '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('QUN AI вернул сценарий не в JSON. Нажми «Разработать сценарий» ещё раз.');
  const parsed = JSON.parse(text.slice(start, end + 1));
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const normalized = {
    title: asText(parsed.title) || 'Новый мультфильм QUN',
    logline: asText(parsed.logline),
    visual_style: asText(parsed.visual_style),
    scenes: scenes.slice(0, 3).map(scene => ({
      title: asText(scene.title) || 'Сцена',
      visual_prompt: asText(scene.visual_prompt || scene.visual_prompt_en || scene.prompt)
    })),
    music_prompt: asText(parsed.music_prompt),
    dialogue_script: asText(parsed.dialogue_script || parsed.dialogue || parsed.dialogues),
    dialogue_voice_prompt: asText(parsed.dialogue_voice_prompt || parsed.voice_prompt),
    assembly_notes: asText(parsed.assembly_notes)
  };
  if (normalized.scenes.length !== 3 || normalized.scenes.some(scene => !scene.visual_prompt)) {
    throw new Error('В сценарии должны быть ровно 3 сцены с визуальными промптами. Попробуй сгенерировать ещё раз.');
  }
  if (!normalized.dialogue_script) {
    throw new Error('QUN AI не вернул диалоги. Попробуй сгенерировать сценарий ещё раз.');
  }
  return normalized;
}

function renderFilm(film) {
  const scenes = film.scenes.map((scene, index) =>
    '<div class="scene"><b>Сцена ' + (index + 1) + ': ' + esc(scene.title) +
    '</b><p><b>Визуальный промпт для генератора</b></p><p class="prewrap">' +
    esc(scene.visual_prompt) + '</p></div>'
  ).join('');
  $('brief').innerHTML =
    '<h2>' + esc(film.title) + '</h2>' +
    '<p class="prewrap">' + esc(film.logline) + '</p>' +
    '<h3>Визуальный стиль</h3><p class="prewrap">' + esc(film.visual_style) + '</p>' +
    scenes +
    '<h3>Музыка</h3><p class="prewrap">' + esc(film.music_prompt) + '</p>' +
    '<h3>Диалоги персонажей</h3><p class="prewrap">' + esc(film.dialogue_script) + '</p>' +
    '<h3>Режиссура голосов</h3><p class="prewrap">' + esc(film.dialogue_voice_prompt) + '</p>' +
    '<h3>Заметки к монтажу</h3><p class="prewrap">' + esc(film.assembly_notes) + '</p>';
  $('result').hidden = false;
}

function setSignedIn(session) {
  $('auth').hidden = !!session;
  $('app').hidden = !session;
  if (!session) $('result').hidden = true;
}

$('login').onclick = async () => {
  const { data, error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(), password: $('password').value
  });
  $('authstatus').textContent = error ? error.message : 'Входим…';
  if (data.session) setSignedIn(data.session);
};
$('signup').onclick = async () => {
  const { data, error } = await db.auth.signUp({
    email: $('email').value.trim(), password: $('password').value
  });
  $('authstatus').textContent = error ? error.message : 'Аккаунт создан. Если требуется подтверждение, проверь почту.';
  if (data.session) setSignedIn(data.session);
};
$('signout').onclick = async () => {
  await db.auth.signOut();
  film = null;
  window.qunFilm = null;
  setSignedIn(null);
};
$('plan').onclick = async () => {
  const idea = $('idea').value.trim();
  if (!idea) {
    $('status').textContent = 'Сначала опиши идею.';
    return;
  }
  const button = $('plan');
  button.disabled = true;
  $('status').textContent = 'QUN AI пишет сценарий по-русски…';
  try {
    const prompt = [
      'Создай законченный сценарий короткого мультфильма-клипа по идее пользователя. Язык сценария — РУССКИЙ.',
      'Верни ТОЛЬКО один валидный JSON-объект без Markdown и без пояснений.',
      'Точная схема:',
      '{"title":"название на русском","logline":"краткий синопсис на русском","visual_style":"описание визуального стиля на русском","scenes":[{"title":"название сцены на русском","visual_prompt":"Detailed English visual prompt for a video-generation model; describe only visual action, camera, lighting, character appearance and continuity; no subtitles, no written text"},{"title":"...","visual_prompt":"..."},{"title":"...","visual_prompt":"..."}],"music_prompt":"English prompt for original instrumental music, no copyrighted artist imitation","dialogue_script":"6-10 short spoken lines in NATURAL RUSSIAN, each on a separate line as Имя персонажа: «реплика»","dialogue_voice_prompt":"Инструкция на русском: персонажи говорят только по-русски; опиши тембр, эмоции, различия голосов, темп и произношение","assembly_notes":"инструкции монтажёру на русском"}',
      'Требования: ровно 3 связанные сцены; одинаковый внешний вид персонажей во всех сценах; живые, добрые и естественные русские диалоги, соответствующие происходящему; не заменяй диалоги описанием; не пиши реплики на английском. Названия, синопсис, стиль, диалоги, голоса и монтажные заметки — на русском. Только visual_prompt и music_prompt должны быть на английском, чтобы генераторы лучше понимали их.',
      'Идея пользователя: ' + idea
    ].join('\n\n');
    const { data, error } = await db.functions.invoke('qun-ai-chat', {
      body: { messages: [{ role: 'user', content: prompt }] }
    });
    if (error) {
      let detail = error.message || 'Не удалось вызвать QUN AI.';
      try {
        const body = await error.context.json();
        if (body.error) detail = body.error;
      } catch (_) {}
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    film = parseFilm(data?.reply);
    window.qunFilm = film;
    renderFilm(film);
    $('status').textContent = 'Сценарий готов. История и диалоги — на русском; английский оставлен только в промптах генераторов.';
  } catch (error) {
    $('status').textContent = 'Не удалось подготовить сценарий: ' + (error.message || String(error));
  } finally {
    button.disabled = false;
  }
};

const { data: { session } } = await db.auth.getSession();
setSignedIn(session);
db.auth.onAuthStateChange((_event, session) => setSignedIn(session));
