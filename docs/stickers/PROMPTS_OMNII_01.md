# PROMPTS — Omnii / QUN Pack 01

**Pack ID:** qun_omnii_01  
**Цель:** 24 отдельных статичных стикера.  
**Язык промтов:** английский — большинство моделей точнее понимают визуальные детали.

Важно: генерировать каждый стикер отдельным файлом. Никогда не просить модель создать один лист или коллаж из 24 картинок.

## A. Character lock — добавлять в каждый промт

The exact same original mascot character in every image: a tiny adorable fluffy round creature named Omnii, soft ivory-white plush fur with a slightly shaggy silhouette, very large expressive pale ice-blue faceted crystal eyes with gentle highlights, tiny simple mouth, two tiny rounded arms and short feet, friendly warm personality, consistent head-to-body proportions, same eye shape and same fur texture in every image. Premium polished 3D animated collectible character, soft tactile materials, clean smooth lighting, charming readable silhouette, restrained QUN palette accents of deep blue, emerald green and soft gold only when needed. The character must remain unmistakably identical to the approved reference image.

## B. Sticker composition lock — добавлять в каждый промт

One single full-body character, centered, large and readable at small chat size, clear silhouette, expressive pose readable instantly, entire character and all props fully inside the square canvas with generous safe margin, clean thick white sticker outline around the complete silhouette, very subtle soft dark-blue drop shadow, isolated subject. No words, no letters, no typography, no watermark, no signature, no logo, no border around the canvas, no collage, no grid, no multiple views. Transparent background if supported. If true transparency is not supported, use a perfectly flat pure chroma-key magenta background (#FF00FF), with absolutely no magenta objects or reflections on the character.

## C. Negative prompt

text, letters, words, typography, watermark, signature, logo, brand mark, multiple characters, duplicate character, collage, contact sheet, grid, split panel, cropped body, cropped ears, cropped hands, extra limbs, extra fingers, malformed paws, distorted eyes, different eye colors, different character design, realistic human, scary, angry, horror, cluttered background, scenery, gradients in background, patterned background, magenta fur, magenta clothes, magenta props, low resolution, blur, noise, jpeg artifacts, oversharpening.

## D. Сначала — эталон персонажа

Сгенерируй четыре варианта Omnii без реквизита: персонаж стоит, смотрит прямо в камеру, лапки спокойно опущены, лёгкая добрая улыбка. Белый/кремовый пушистый мех, крупные кристально-голубые глаза, мягкий объёмный 3D-стиль, прозрачный или чистый однотонный фон. Один персонаж, полный рост, квадратный кадр.

Утвердить один вариант и сохранить как omnii-reference.png. Только после этого рисовать набор.

## E. Reference image rules

1. Использовать утверждённое изображение omnii-reference.png как image reference / IP-Adapter reference для всех 24 стикеров, если workflow это поддерживает.
2. Держать неизменными модель, стиль, seed-подход, размер кадра и основной Character lock.
3. Менять только действие и реквизит, описанные для конкретного стикера.
4. Сначала протестировать сюжеты 01, 06 и 09. Если персонаж заметно меняется, остановиться и исправить workflow.
5. Генерировать по 3 варианта на сюжет; выбирать и сохранять лучший вариант.
6. Один запрос = один файл, квадрат 512×512 или 768×768. Не использовать contact sheet.

## F. Individual prompts

Для каждого стикера объединить Character lock + Sticker composition lock + описание сцены ниже. В negative prompt добавить раздел C.

### 01 — Hello / 👋
Omnii is happily greeting a friend, standing upright and raising one tiny paw in a clear friendly wave. Bright welcoming eyes, small warm smile, a tiny gentle sparkle near the raised paw. Keep both feet visible.

### 02 — Happy / 😄
Omnii is bursting with uncomplicated joy, eyes smiling, mouth open in a delighted grin, both tiny paws lifted close to its cheeks. A few small soft golden sparkles float near the head, not behind the character.

### 03 — Thanks / 🥰
Omnii holds a small glowing soft-gold heart carefully between both paws, looking grateful and tender. Warm eyes, slight head tilt, intimate sincere expression. The heart is simple and clearly separated from the face.

### 04 — Love / ❤️
Omnii hugs one large soft red heart against its fluffy chest, eyes shining with affection. Add two or three tiny floating hearts close to the character, keep the silhouette uncluttered.

### 05 — Hug / 🤗
Omnii opens both tiny arms wide, leaning forward slightly to invite a hug. Very kind bright expression, gentle blush on cheeks, no extra objects.

### 06 — Laugh / 😂
Omnii laughs uncontrollably with eyes squeezed into happy arcs, mouth open in a joyful laugh, tiny tears of laughter at the outer corners, body slightly bouncing. Keep the expression cute, not exaggerated into distortion.

### 07 — Cry / 😢
Omnii looks genuinely sad with one large crystal-clear tear rolling down one cheek, ears/body slightly lowered, paws held close. The expression should feel tender and sympathetic rather than frightening.

### 08 — Sorry / 🥺
Omnii bows its fluffy head a little, brings both paws together in a small apologetic gesture, and looks upward with very gentle pleading eyes. One tiny soft sparkle, no text.

### 09 — Thinking / 🤔
Omnii sits slightly turned, one tiny paw touching its chin, eyes looking upward to one side, thoughtful curious expression. A tiny pale-blue question-mark-shaped sparkle may be used, but do not include a written punctuation symbol.

### 10 — Idea / 💡
Omnii suddenly has a bright idea, raising one paw while a small elegant soft-gold glowing light bulb floats just above it. Wide excited eyes, clear simple silhouette.

### 11 — Wow / 😮
Omnii is amazed, eyes very wide, mouth forming a small round expression, both paws lifted slightly. A few small blue-white sparkle rays around the head, no background scene.

### 12 — Yes / 👍
Omnii gives a clear enthusiastic thumbs-up with one tiny paw, standing confidently and smiling. Make the hand/paw shape simple and anatomically clean.

### 13 — No / 🙅
Omnii gently crosses both tiny paws in front of its chest to signal no, with a firm but kind expression. The gesture must be immediately readable; no harsh anger.

### 14 — Shrug / 🤷
Omnii raises both paws slightly and gives a small shoulder shrug, head tilted to one side, eyebrows lifted in a cute puzzled expression. Keep body round and balanced.

### 15 — Support / 💙
Omnii offers a small pale-blue glowing heart forward with both paws, looking caring and reassuring. The gesture feels like “I'm with you” without words.

### 16 — Coffee / ☕
Omnii holds a tiny simple warm ceramic cup with both paws, enjoying a quiet cozy break. A small curl of steam rises above the cup; no letters or logos on the cup.

### 17 — Sleep / 😴
Omnii is curled into a very soft round sleeping pose on a tiny crescent-shaped pale-blue pillow, eyes peacefully closed. One small floating star. Keep the entire pillow and character inside the frame.

### 18 — Morning / 🌞
Omnii stretches both tiny arms after waking up, smiling sleepily. A small soft-gold sun icon floats nearby, simple and separate from the character.

### 19 — Party / 🎉
Omnii joyfully celebrates with both paws raised, smiling widely. A few small confetti pieces and two tiny streamers around the character, using QUN blue, emerald and soft gold. Do not clutter the outline.

### 20 — Wait / ⏳
Omnii sits patiently with paws resting on its knees, looking forward with a calm slightly expectant expression. A tiny simple hourglass stands beside it, not covering the character.

### 21 — Work / 💻
Omnii sits behind a tiny simple open laptop, focused but cheerful, with one paw raised as if saying “working on it”. The laptop is plain, with no text or brand logo.

### 22 — Done / ✅
Omnii stands proudly with a satisfied smile and gives a small confident nod. A clean emerald check mark floats beside the head, clearly separated from the character.

### 23 — Peace / ✌️
Omnii raises one paw in a clear two-finger peace sign, tilts its head playfully, and smiles. Keep the fingers/paw simple and readable at small size.

### 24 — Bye / 👋
Omnii turns slightly to one side and waves goodbye with one paw, warm smile and a tiny trail of soft blue-gold sparkles. This should feel like a friendly closing, different from the front-facing hello pose.

## G. Vision QA prompt

Review every supplied image against the approved Omnii reference. Check: same character identity; emotion clear at 128×128; complete silhouette and safe margin; exactly one character; no text or watermark; consistent eyes, fur, proportions and palette; no malformed paws or visual artifacts; real transparency or clean removable chroma key; readable on light and dark chat backgrounds.

Return a table with filename, score 1–5, detected defects, and decision ACCEPT / REGENERATE / HUMAN REVIEW. Never mark a missing file as accepted.
