#!/usr/bin/env tsx

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

interface Slide {
  type: string;
  text_to_tts: string;
  z_image_prompt: string;
}

interface Scenario {
  slides: Slide[];
}

interface SlideMetadata {
  index: number;
  type: string;
  text_to_tts: string;
  z_image_prompt: string;
  original_image: string;
  object_image: string;
  background_image: string;
  pivot: {
    x: number;
    y: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  completed: boolean;
}

interface GenerationState {
  scenario?: Scenario;
  slides: SlideMetadata[];
  completed: boolean;
}

interface RemotionData {
  slides: SlideMetadata[];
  totalDuration: number;
  slideDuration: number;
  fps: number;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OUTPUT_DIR = './output';
const TEMP_DIR = './temp';
const SLIDE_DURATION = 5; // 5 секунд на слайд для плавной анимации
const FPS = 30;
const STATE_FILE = path.join(OUTPUT_DIR, 'state.json');
const REMOTION_DATA_FILE = path.join(OUTPUT_DIR, 'remotion-data.json');

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // ignore
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadState(): Promise<GenerationState> {
  if (await fileExists(STATE_FILE)) {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  }
  return {
    slides: [],
    completed: false
  };
}

async function saveState(state: GenerationState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function generateScenario(state: GenerationState): Promise<Scenario> {
  // Проверяем, есть ли уже сценарий в state
  if (state.scenario) {
    console.log('📋 Используем существующий сценарий из состояния');
    return state.scenario;
  }

  console.log('🎬 Генерация нового сценария через Gemini...');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `сделай сценарий для вирусного рилса про 
SCP-101-RU - "Квартира-Архив": Типичная квартира в пятиэтажке, где все предметы на своих местах, но они меняются местами каждый час, как бы "перезаписывая" историю.

  картинки все мрачные и странные с вайбом аналогового хоррора
используй постсоветскую тематику в промптах
первый слайд максимально захватывающий и надо чтобы он сразу зацепил внимание, картинка должна интриговать и быть странной постсоветская картинка с загадочным объектом и подписью

надо на 25 секунд и на 5 слайдов (по 5 секунд на слайд)

Начинай с хука который мгновенно захватит внимание.

ВАЖНО про промпты для изображений:
- Изображения будут обрабатываться через AI который ОТДЕЛИТ ГЛАВНЫЙ ОБЪЕКТ ОТ ФОНА
- Каждое изображение должно иметь ОДИН ЧЕТКИЙ ГЛАВНЫЙ ОБЪЕКТ (человек, предмет, символ) который можно легко отделить от фона
- НЕ создавай сложные композиции с множеством элементов
- Главный объект должен быть в центре или чуть выше центра
- Фон должен быть отличим от объекта (не сливаться)

ВАЖНО про текст на изображениях:
- ТОЛЬКО на ПЕРВОМ слайде (hook) добавь текст СВЕРХУ изображения
- На остальных слайдах (2-5) НЕ ДОЛЖНО БЫТЬ НИКАКОГО ТЕКСТА на изображении
- Текст озвучки будет добавлен отдельно

вот тебе пример правильного промпта:
cinematic photograph of a solitary hooded hacker figure, centered, dramatic lighting from behind creating a silhouette effect. The figure stands out clearly against a dark blurred background with subtle blue digital elements. Clear separation between subject and background. Superimposed at the TOP of the image in a bold, glitched font: 'КТО ОН?' -- moody, atmospheric, dark, cinematic

пример БЕЗ текста для слайдов 2-5:
dramatic close-up portrait of a mysterious figure in shadow, one hand holding a vintage phone glowing with ethereal light. The figure is the clear focal point, well-defined against a softly blurred background of abstract digital patterns. -- enigmatic, cinematic, atmospheric

язык русский для text_to_tts
язык английский для z_image_prompt

отдай в формате json:
{
  "slides": [{
    "type": "hook",
    "text_to_tts": "текст на русском для озвучки",
    "z_image_prompt": "english prompt with text ONLY for first slide"
  }]
}

никаких лишних данных возвращай только json`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Извлекаем JSON из ответа (убираем markdown форматирование если есть)
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
  }

  const scenario: Scenario = JSON.parse(jsonText);
  console.log(`✅ Сценарий сгенерирован: ${scenario.slides.length} слайдов`);

  // Сохраняем сценарий в state
  state.scenario = scenario;
  await saveState(state);

  return scenario;
}

async function generateImage(prompt: string, outputPath: string): Promise<void> {
  console.log(`🎨 Генерация изображения...`);

  const cmd = `sd-z --diffusion-model /Users/admin/projects/ai/zimage/z_image_turbo-Q4_1.gguf --vae /Users/admin/projects/ai/zimage/ae-f16.gguf --llm /Users/admin/projects/ai/zimage/qwen_3_4b.safetensors --cfg-scale 1 -p "${prompt}" --clip-on-cpu --diffusion-fa -H 640 -W 480 --steps 8 --lora-model-dir /Users/admin/projects/ai/zimage/ -o "${outputPath}"`;

  try {
    await execAsync(cmd);
    console.log(`✅ Изображение сгенерировано: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Ошибка генерации изображения:`, error);
    throw error;
  }
}

async function separateBackgroundAndObject(imagePath: string, outputDir: string): Promise<{ object: string; background: string }> {
  console.log(`🔪 Отделение фона от объекта...`);

  const objectDestDir = path.join(outputDir, 'object_output');
  const backgroundDestDir = path.join(outputDir, 'background_output');

  // Создаем объект (без фона)
  // transparent-background создаст папку object_output и файл original_rgba.png внутри
  await execAsync(`transparent-background --source "${imagePath}" --dest "${objectDestDir}"`);

  // Создаем фон (без объекта)
  // transparent-background создаст папку background_output и файл original_rgba_reverse.png внутри
  await execAsync(`transparent-background --source "${imagePath}" --reverse --threshold=0.1 --dest "${backgroundDestDir}"`);

  console.log(`✅ Разделение завершено`);

  const objectPath = path.join(objectDestDir, 'original_rgba.png');
  const backgroundPath = path.join(backgroundDestDir, 'original_rgba_reverse.png');

  return { object: objectPath, background: backgroundPath };
}

async function findObjectCenter(imagePath: string): Promise<{ x: number; y: number; width: number; height: number }> {
  console.log(`📍 Поиск центра объекта...`);

  const image = sharp(imagePath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let maxX = 0;
  let minY = info.height;
  let maxY = 0;
  let hasPixels = false;

  // Ищем границы непрозрачных пикселей
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const alpha = info.channels === 4 ? data[idx + 3] : 255;

      if (alpha > 10) { // пороговое значение для определения непрозрачности
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) {
    // Если нет непрозрачных пикселей, используем центр изображения
    return { x: info.width / 2, y: info.height / 2, width: info.width, height: info.height };
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  console.log(`✅ Центр найден: x=${centerX.toFixed(0)}, y=${centerY.toFixed(0)}`);

  return { x: centerX, y: centerY, width: info.width, height: info.height };
}

// Удалена функция createParallaxAnimation - анимация будет в Remotion

async function processSlide(
  slide: Slide,
  index: number,
  slideDir: string,
  state: GenerationState
): Promise<SlideMetadata> {
  // Проверяем, не обработан ли уже этот слайд
  const slideState = state.slides.find(s => s.index === index);
  if (slideState?.completed) {
    console.log(`\n⏭️  Слайд ${index + 1} уже обработан, пропускаем`);
    return slideState;
  }

  console.log(`\n🎬 Обработка слайда ${index + 1}...`);
  console.log(`📝 Текст: ${slide.text_to_tts.substring(0, 50)}...`);

  const imagePath = path.join(slideDir, 'original.png');

  // 1. Генерируем изображение
  if (!await fileExists(imagePath)) {
    await generateImage(slide.z_image_prompt, imagePath);
  } else {
    console.log('⏭️  Изображение уже существует');
  }

  // 2. Отделяем фон от объекта
  const objectPath = path.join(slideDir, 'object_output', 'original_rgba.png');
  const backgroundPath = path.join(slideDir, 'background_output', 'original_rgba_reverse.png');

  let object: string, background: string;
  if (!await fileExists(objectPath) || !await fileExists(backgroundPath)) {
    const result = await separateBackgroundAndObject(imagePath, slideDir);
    object = result.object;
    background = result.background;
  } else {
    console.log('⏭️  Разделение на фон и объект уже выполнено');
    object = objectPath;
    background = backgroundPath;
  }

  // 3. Находим центр объекта и размеры
  const centerData = await findObjectCenter(object);

  console.log(`✅ Слайд ${index + 1} готов`);

  // Создаем метаданные слайда
  const metadata: SlideMetadata = {
    index,
    type: slide.type,
    text_to_tts: slide.text_to_tts,
    z_image_prompt: slide.z_image_prompt,
    original_image: path.relative(OUTPUT_DIR, imagePath),
    object_image: path.relative(OUTPUT_DIR, object),
    background_image: path.relative(OUTPUT_DIR, background),
    pivot: {
      x: centerData.x,
      y: centerData.y
    },
    dimensions: {
      width: centerData.width,
      height: centerData.height
    },
    completed: true
  };

  // Обновляем состояние слайда
  const existingSlideIndex = state.slides.findIndex(s => s.index === index);
  if (existingSlideIndex >= 0) {
    state.slides[existingSlideIndex] = metadata;
  } else {
    state.slides.push(metadata);
  }

  await saveState(state);

  return metadata;
}

// Удалена функция combineVideos - сборка будет в Remotion

async function main() {
  console.log('🚀 Запуск генератора рилсов...\n');

  if (!GEMINI_API_KEY) {
    console.error('❌ Не указан GEMINI_API_KEY');
    console.error('Установите переменную окружения: export GEMINI_API_KEY=your_api_key');
    process.exit(1);
  }

  // Создаем необходимые директории
  await ensureDir(OUTPUT_DIR);
  await ensureDir(TEMP_DIR);

  try {
    // Загружаем состояние
    const state = await loadState();

    if (state.completed) {
      console.log('✅ Подготовка материалов уже завершена!');
      console.log(`📁 Данные для Remotion: ${REMOTION_DATA_FILE}`);
      return;
    }

    // 1. Генерируем или загружаем сценарий
    const scenario = await generateScenario(state);

    // Сохраняем сценарий в отдельный файл для удобства просмотра
    const scenarioPath = path.join(OUTPUT_DIR, 'scenario.json');
    if (!await fileExists(scenarioPath)) {
      await fs.writeFile(scenarioPath, JSON.stringify(scenario, null, 2));
    }

    // 2. Обрабатываем каждый слайд
    const slidesMetadata: SlideMetadata[] = [];

    for (let i = 0; i < scenario.slides.length; i++) {
      const slide = scenario.slides[i];
      const slideDir = path.join(TEMP_DIR, `slide_${i}`);
      await ensureDir(slideDir);

      const metadata = await processSlide(slide, i, slideDir, state);
      slidesMetadata.push(metadata);
    }

    // 3. Создаем JSON для Remotion
    const remotionData: RemotionData = {
      slides: slidesMetadata,
      totalDuration: scenario.slides.length * SLIDE_DURATION,
      slideDuration: SLIDE_DURATION,
      fps: FPS
    };

    await fs.writeFile(REMOTION_DATA_FILE, JSON.stringify(remotionData, null, 2));

    // Обновляем состояние
    state.completed = true;
    await saveState(state);

    console.log('\n🎉 Подготовка материалов завершена успешно!');
    console.log(`📁 Данные для Remotion: ${REMOTION_DATA_FILE}`);
    console.log(`\n💡 Теперь используй эти данные в Remotion для создания финального видео`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  }
}

main();

