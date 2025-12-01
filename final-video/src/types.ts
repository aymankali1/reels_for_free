export interface SlideData {
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
  audio_path?: string;
  duration?: number;
  completed: boolean;
}

export interface RemotionData {
  slides: SlideData[];
  totalDuration: number;
  slideDuration: number;
  fps: number;
}

