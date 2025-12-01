import React from 'react';
import { Series } from 'remotion';
import { SlideParallax } from './SlideParallax';
import { RemotionData } from './types';
import remotionData from '../../output/remotion-data.json';

export const Reel: React.FC = () => {
  const data = remotionData as RemotionData;
  const fps = data.fps;

  return (
    <Series>
      {data.slides.map((slide) => {
        // Используем реальную длительность аудио или fallback на среднюю
        const duration = slide.duration || data.slideDuration;
        const durationInFrames = Math.ceil(duration * fps);

        return (
          <Series.Sequence key={slide.index} durationInFrames={durationInFrames}>
            <SlideParallax slide={slide} />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};

