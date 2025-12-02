#!/bin/bash

set -e

echo "🎵 Добавление музыки к финальному видео..."

# Проверяем наличие видео с субтитрами
if [ ! -f "captions/output/final-with-subs.mp4" ]; then
    echo "❌ Видео с субтитрами не найдено: captions/output/final-with-subs.mp4"
    echo "Сначала запустите: pnpm add-captions"
    exit 1
fi

# Проверяем наличие музыки
if [ ! -f "music.mp3" ]; then
    echo "❌ Файл музыки не найден: music.mp3"
    echo "Положите файл music.mp3 в корень проекта"
    exit 1
fi

# Создаем директорию для финального вывода
mkdir -p output/final

# Получаем длительность видео
VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 captions/output/final-with-subs.mp4)

echo "📹 Длительность видео: ${VIDEO_DURATION}s"
echo "🎵 Добавление музыки с громкостью -6dB..."

# Добавляем музыку:
# - Обрезаем музыку до длины видео
# - Понижаем громкость музыки до -6dB
# - Микшируем с оригинальным аудио (речь остается на нормальной громкости)
ffmpeg -i captions/output/final-with-subs.mp4 -stream_loop -1 -i music.mp3 -filter_complex \
    "[1:a]volume=-8dB,atrim=0:${VIDEO_DURATION},asetpts=PTS-STARTPTS[music]; \
     [0:a][music]amix=inputs=2:duration=shortest[aout]" \
    -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest \
    output/final/final-reel.mp4 -y

echo ""
echo "🎉 Готово!"
echo "📁 Финальное видео с музыкой: output/final/final-reel.mp4"
echo ""
echo "💡 Это финальная версия готовая к публикации!"

