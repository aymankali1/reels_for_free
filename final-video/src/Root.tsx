import "./index.css";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import remotionData from "../../output/remotion-data.json";

export const RemotionRoot: React.FC = () => {
  const data = remotionData as any;
  
  // Вычисляем общую длительность на основе реальных таймингов
  const totalFrames = data.slides.reduce((sum: number, slide: any) => {
    const duration = slide.duration || data.slideDuration;
    return sum + Math.ceil(duration * data.fps);
  }, 0);

  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={totalFrames}
        fps={data.fps}
        width={data.slides[0]?.dimensions.width || 480}
        height={data.slides[0]?.dimensions.height || 640}
      />
    </>
  );
};
