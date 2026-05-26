import { Composition } from "remotion";
import { Main, MAIN_DURATION_FRAMES, FPS } from "./Main";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={MAIN_DURATION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
