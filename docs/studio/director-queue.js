import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const db = createClient(
  'https://qdxjltqlnphvzafapncm.supabase.co',
  'sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L'
);
const $ = id => document.getElementById(id);
let currentProjectId = null;
let currentJobIds = [];

function textPlan(film) {
  return [
    film.title,
    film.logline,
    'ВИЗУАЛЬНЫЙ СТИЛЬ: ' + film.visual_style,
    ...film.scenes.map((scene, index) => 'СЦЕНА ' + (index + 1) + ': ' + scene.title + '\n' + scene.visual_prompt),
    'МУЗЫКА: ' + film.music_prompt,
    'ГОЛОСА: ' + film.dialogue_voice_prompt,
    'ДИАЛОГИ:\n' + film.dialogue_script,
    'МОНТАЖ: ' + film.assembly_notes
  ].join('\n\n');
}

async function invokeError(error) {
  let message = error?.message || 'Запрос к QUN Compute завершился ошибкой.';
  try {
    const body = await error.context.json();
    if (body?.error) message = body.error + (body.code ? ' (' + body.code + ')' : '');
  } catch (_) {}
  return message;
}

$('copy').onclick = async () => {
  const film = window.qunFilm;
  if (!film) {
    $('status').textContent = 'Сначала разработай сценарий.';
    return;
  }
  try {
    await navigator.clipboard.writeText(textPlan(film));
    $('status').textContent = 'Сценарий, диалоги и промпты скопированы.';
  } catch (error) {
    $('status').textContent = 'Не удалось скопировать: ' + (error.message || String(error));
  }
};

$('queue').onclick = async () => {
  const film = window.qunFilm;
  if (!film) {
    $('status').textContent = 'Сначала разработай сценарий.';
    return;
  }
  const button = $('queue');
  button.disabled = true;
  button.textContent = 'Отправляем задачи…';
  const tasks = [
    ...film.scenes.map((scene, index) => ({
      title: film.title + ' — сцена ' + (index + 1),
      prompt: scene.visual_prompt,
      jobType: 'video_generation',
      requirements: {
        engine: 'comfyui',
        requested_output: 'video',
        workflow_key: 'video',
        production: {
          title: film.title,
          scene_index: index + 1,
          scene_count: 3,
          visual_style: film.visual_style,
          dialogue_script: film.dialogue_script
        }
      }
    })),
    {
      title: film.title + ' — музыка',
      prompt: film.music_prompt,
      jobType: 'audio_generation',
      requirements: {
        engine: 'comfyui',
        requested_output: 'audio',
        workflow_key: 'music',
        production: { title: film.title }
      }
    },
    {
      title: film.title + ' — диалоги персонажей',
      prompt: 'Создай аудио с произнесёнными вслух русскими репликами персонажей. Все реплики произносятся только на русском языке. Сохраняй точный текст сценария и различай голоса персонажей.\nРежиссура голосов: ' +
        film.dialogue_voice_prompt + '\nСценарий диалогов:\n' + film.dialogue_script,
      jobType: 'audio_generation',
      requirements: {
        engine: 'comfyui',
        requested_output: 'audio',
        workflow_key: 'dialogue',
        production: {
          title: film.title,
          dialogue_script: film.dialogue_script,
          language: 'ru'
        }
      }
    }
  ];

  let created = [];
  try {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.access_token) throw new Error('Сессия не найдена. Выйди и войди в QUN Director заново.');

    const projectSlug = 'qun-director-' + Date.now();
    const { data: project, error: projectError } = await db.from('qun_studio_projects').insert({
      slug: projectSlug,
      title: film.title.slice(0, 160),
      description: film.logline || 'Проект создан QUN Director',
      status: 'active',
      created_by: sessionData.session.user.id,
      metadata: { source: 'QUN Director', language: 'ru', scene_count: 3, has_music: true, has_dialogue: true }
    }).select('id').single();
    if (projectError) throw new Error('Не удалось создать проект в библиотеке QUN: ' + projectError.message);
    currentProjectId = project.id;
    currentJobIds = [];

    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      $('status').textContent = 'Отправляем ' + (index + 1) + '/' + tasks.length + ': ' + task.title;
      const { data, error } = await db.functions.invoke('qun-compute', {
        body: {
          action: 'create_job',
          title: task.title.slice(0, 150),
          prompt: task.prompt,
          jobType: task.jobType,
          requirements: task.requirements
        }
      });
      if (error) throw new Error(await invokeError(error));
      if (data?.error) throw new Error(data.error);
      if (!data?.job?.job_id) throw new Error('Сервер ответил без ID задачи. Ответ: ' + JSON.stringify(data));
      created.push({ title: task.title, id: data.job.job_id, status: data.job.status || 'queued' });
      currentJobIds.push(data.job.job_id);
      $('status').textContent = 'Добавлено ' + created.length + '/' + tasks.length + ': ' + task.title;
    }

    $('status').textContent = 'Готово! В QUN Compute поставлено ' + created.length + ' задач:\n' +
      created.map((task, index) => (index + 1) + '. ' + task.title + ' — ' + task.status + ' — ' + task.id).join('\n') +
      '\n\nВажно: задача диалогов создаёт отдельное аудио, если подключён совместимый workflow_key=dialogue. Финальная сборка клипа пока отдельный этап.';
  } catch (error) {
    $('status').textContent = 'Не удалось отправить все задачи. Успешно добавлено ' + created.length + '/' + tasks.length + '.' +
      (created.length ? '\nУже поставлены:\n' + created.map(task => task.title + ' — ' + task.id).join('\n') : '') +
      '\nОшибка: ' + (error.message || String(error)) +
      '\nПроверь, что ты вошёл в QUN и что QUN Compute доступен.';
  } finally {
    button.disabled = false;
    button.textContent = 'Поставить 5 задач в QUN Compute';
  }
};


$('refreshJobs').onclick = async () => {
  const button = $('refreshJobs');
  button.disabled = true;
  try {
    const { data, error } = await db.functions.invoke('qun-compute', { body: { action: 'my_jobs' } });
    if (error) throw new Error(await invokeError(error));
    if (data?.error) throw new Error(data.error);
    const mine = (data.jobs || []).filter(job => currentJobIds.includes(job.job_id));
    if (!mine.length) throw new Error('В этой сессии не найдено задач. Создай новую очередь или обнови страницу после входа.');
    const labels = { queued: 'в очереди', running: 'выполняется', succeeded: 'готово', failed: 'ошибка', cancelled: 'отменено', retrying: 'повтор' };
    $('status').textContent = 'Статус проекта «' + (window.qunFilm?.title || 'QUN') + '»\\n' +
      mine.map((job, index) => (index + 1) + '. ' + job.title + ' — ' + (labels[job.status] || job.status) +
        (job.error_message ? '\\n   Ошибка: ' + job.error_message : '') +
        (job.result?.outputs?.length ? '\\n   Файлы: ' + job.result.outputs.map(x => x.filename || x.url || '').filter(Boolean).join(', ') : '')).join('\\n') +
      '\\n\\nГотово: ' + mine.filter(job => job.status === 'succeeded').length + '/' + mine.length +
      '. Сборка MP4 станет доступна после реализации и проверки сборщика.';
  } catch (error) {
    $('status').textContent = 'Не удалось обновить статусы: ' + (error.message || String(error));
  } finally {
    button.disabled = false;
  }
};
