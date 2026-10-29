import React from 'react';
import { Composition } from 'remotion';
import { PeelScene } from './PeelScene';

export const RemotionRoot: React.FC = () => (
  <Composition id="PeelScene" component={PeelScene} durationInFrames={240} fps={30} width={1920} height={1080} />
);
