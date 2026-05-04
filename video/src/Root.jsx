import React from 'react';
import { Composition } from 'remotion';
import { Explainer } from './compositions/Explainer';

export const RemotionRoot = () => {
  return (
    <Composition
      id="Explainer"
      component={Explainer}
      durationInFrames={960}
      fps={30}
      width={1080}
      height={1080}
    />
  );
};
