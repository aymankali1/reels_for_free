import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, staticFile, Audio } from 'remotion';
import { SlideData } from './types';
import { easeInOutCubic } from './utils/easing';

interface SlideParallaxProps {
  slide: SlideData;
}

export const SlideParallax: React.FC<SlideParallaxProps> = ({ slide }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Прогресс анимации от 0 до 1
  const progress = frame / durationInFrames;

  // Применяем easing
  const t = easeInOutCubic(progress);

  // Масштаб: от 1.0 до 1.15 для фона, от 1.0 до 1.4 для объекта
  const bgScale = 1.0 + 0.15 * t;
  const objScale = 1.0 + 0.4 * t;

  // Pivot в процентах от размера изображения
  const pivotXPercent = (slide.pivot.x / slide.dimensions.width) * 100;
  const pivotYPercent = (slide.pivot.y / slide.dimensions.height) * 100;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Аудио */}
      {slide.audio_path && (
        <Audio src={staticFile(slide.audio_path.replace('../', ''))} />
      )}

      {/* Фон - масштабируется вокруг центра */}
      <div
        style={{
          position: 'absolute',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
        }}
      >
        <Img
          src={staticFile(slide.background_image.replace('../', ''))}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${bgScale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Объект - масштабируется вокруг pivot */}
      <div
        style={{
          position: 'absolute',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
        }}
      >
        <Img
          src={staticFile(slide.object_image.replace('../', ''))}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${objScale})`,
            transformOrigin: `${pivotXPercent}% ${pivotYPercent}%`,
          }}
        />
      </div>

      {/* Текст (опционально) */}
      {/* <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: 40,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '20px 30px',
            borderRadius: 10,
            maxWidth: '80%',
          }}
        >
          <p
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: 'bold',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {slide.text_to_tts}
          </p>
        </div>
      </AbsoluteFill> */}
    </AbsoluteFill>
  );
};

