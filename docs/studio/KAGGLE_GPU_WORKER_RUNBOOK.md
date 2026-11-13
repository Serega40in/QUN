# QUN Kaggle GPU Worker — рабочая инструкция

Дата проверки: 2026-11-13  
Статус: **MVP успешно проверен** — генерация через ComfyUI работает, изображение сада с изумрудным кристаллом появилось в QUN Library после задания из QUN Studio.

## 1. Что работает

- Kaggle GPU-сессия и ComfyUI на `http://127.0.0.1:8188`.
- Модель: `/kaggle/working/ComfyUI/models/checkpoints/dreamshaper_8.safetensors`.
- API workflow: `/kaggle/working/ComfyUI/qun_image_api_workflow.json`.
- QUN worker: `/kaggle/working/QUN/docs/studio/comfyui_worker.py`.
- Storage helper: `/kaggle/working/QUN/docs/studio/qun_storage.py`.
- Registry: `/kaggle/working/.config/qun/render-node.json`.
- Выходы ComfyUI: `/kaggle/working/ComfyUI/output`.
- Supabase URL и publishable key берутся из настроек окружения / Kaggle Secrets. **Не печатать и не сохранять ключи и node token в ноутбуке, логах или GitHub.**

## 2. Порядок ячеек ноутбука

Не удалять подготовительные ячейки до проверки, что ноутбук можно перезапустить с чистой Kaggle-сессии. Рекомендуемый компактный порядок:

1. **Подготовка окружения** — клонирование/обновление QUN и установка необходимых зависимостей.
2. **Подготовка ComfyUI** — исходники, необходимые custom nodes и зависимости.
3. **Модель** — проверка/загрузка DreamShaper 8; повторно скачивать модель не нужно, если файл уже есть в текущей сессии.
4. **Workflow** — создание или проверка `qun_image_api_workflow.json`.
5. **ComfyUI server** — запуск сервера в отдельном процессе/ячейке; дождаться ответа `/system_stats` на порту 8188.
6. **QUN node registration / secrets** — восстановление registry и переменных окружения из Kaggle Secrets. Не выводить токены.
7. **GPU worker** — одна активная ячейка запуска `comfyui_worker.py`.
8. **Optional diagnostics** — тестовые запросы, печать исходников, просмотр истории и прочие диагностики можно убрать после проверки; не удалять единственный рабочий шаг, который создаёт workflow, регистрирует узел или восстанавливает секреты.

Перед запуском воркера остановить только старый процесс воркера, если он ещё работает. Не останавливать ComfyUI, если он уже обслуживает запросы. Не запускать два воркера одновременно на одном registry/узле.

## 3. Настройки рабочего процесса

Ожидаемые переменные окружения:

- `QUN_COMFYUI_URL=http://127.0.0.1:8188`
- `QUN_COMFYUI_WORKFLOW_IMAGE=/kaggle/working/ComfyUI/qun_image_api_workflow.json`
- `QUN_COMFYUI_OUTPUT_DIR=/kaggle/working/ComfyUI/output`
- `QUN_NODE_REGISTRY_FILE=/kaggle/working/.config/qun/render-node.json`
- `QUN_SUPABASE_URL=https://qdxjltqlnphvzafapncm.supabase.co`
- `QUN_SUPABASE_PUBLISHABLE_KEY` — загружать из Kaggle Secrets, никогда не печатать.

Для заданий генерации изображения воркер должен использовать операторски настроенный workflow из `QUN_COMFYUI_WORKFLOW_IMAGE`, а не путь к произвольному workflow из пользовательского задания. Положительный prompt передаётся в CLIPTextEncode node `2`; отрицательный prompt — в node `3`. Сохранение результата выполняется ComfyUI, после чего worker регистрирует и сохраняет выход в QUN Storage.

## 4. Русский и английский prompt

### Наблюдение

- Прямая генерация в ComfyUI с подробным **английским** prompt дала ожидаемый сад с кристаллом.
- Ранее похожее задание на русском привело к изображению девушки в комнате.
- Проверка показала, что текст prompt попадает в положительный узел workflow. Это ещё **не доказывает**, что причина только в языке: на результат также влияют формулировка, negative prompt, seed и поведение модели.

### Решение для текущего MVP

Пока использовать английские prompts для сложных визуальных сцен. Для русского интерфейса пользователь может писать по-русски, но перед генерацией нужно показывать подготовленный английский вариант и давать возможность его исправить. Не менять worker/storage pipeline только из-за языковой гипотезы.

### Следующий этап перевода

1. Добавить отдельный шаг подготовки prompt до отправки задания в очередь: `Russian user prompt → English image prompt`.
2. Не подменять описание смыслом от себя; сохранять сущности, композицию, цвета и ограничения.
3. Для перевода использовать явно настроенный переводчик/LLM backend с таймаутом и понятным сообщением об ошибке. Не вшивать API-ключи в клиент или репозиторий.
4. Хранить исходный prompt и переведённый prompt отдельно в метаданных задания, если текущая схема это поддерживает.
5. Если переводчик недоступен — не заявлять, что перевод выполнен; показать пользователю исходный текст и предложить ввести английский вариант.
6. Проверить на нескольких парах RU/EN prompts, включая сцену сада, прежде чем считать автоперевод завершённым.

Пример проверенного английского описания сцены:

> A beautiful bright futuristic QUN garden, a large glowing emerald crystal floating above a calm reflective pond, lush living green trees, soft golden sunlight, elegant white emerald and gold color palette, wide landscape composition, peaceful atmosphere, harmony and inner freedom, highly detailed premium digital illustration. No people, no humans, no indoor scenes, no rooms, no furniture, no sofas, no wardrobes.

## 5. Минимальная проверка после запуска

- [ ] ComfyUI отвечает на `http://127.0.0.1:8188/system_stats`.
- [ ] В логе worker видно сообщение о старте и платформе `linux-gpu`.
- [ ] Отправить одно тестовое задание из QUN Studio.
- [ ] Дождаться завершения задания в логе.
- [ ] Открыть результат именно в QUN Library и визуально проверить соответствие prompt.
- [ ] При неверном результате сохранить job ID, prompt ID и последние строки лога; не публиковать секреты.

## 6. Известные ограничения

- Kaggle-сессия временная: после остановки/перезапуска могут потребоваться повторные шаги подготовки.
- Наличие файла модели в текущей сессии не гарантирует, что он останется после пересоздания окружения.
- Автоматический перевод русских prompts пока не считается реализованным.
- Не считать тестовую генерацию гарантией качества для всех prompts и моделей.
- Не хранить registry token, publishable key, service-role key или другие секреты в GitHub.
