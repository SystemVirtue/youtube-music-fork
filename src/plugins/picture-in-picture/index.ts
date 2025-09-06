import style from './style.css?inline';
import { createPlugin } from '@/utils';

import { onConfigChange, onMainLoad } from './main';
import { onMenu } from './menu';
import { onPlayerApiReady } from './renderer';
import { t } from '@/i18n';

export type PictureInPicturePluginConfig = {
  'enabled': boolean;
  'alwaysOnTop': boolean;
  'savePosition': boolean;
  'saveSize': boolean;
  'hotkey': 'P';
  'pip-position': [number, number];
  'pip-size': [number, number];
  'isInPiP': boolean;
  'useNativePiP': boolean;
  'fullscreenEnabled': boolean;
  'selectedDisplay': number;
  'overlayText': string;
  'overlayPosition': 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  'overlayFontSize': number;
  'overlayOpacity': number;
};

export default createPlugin({
  name: () => t('plugins.picture-in-picture.name'),
  description: () => t('plugins.picture-in-picture.description'),
  restartNeeded: true,
  config: {
    'enabled': false,
    'alwaysOnTop': true,
    'savePosition': true,
    'saveSize': false,
    'hotkey': 'P',
    'pip-position': [10, 10],
    'pip-size': [450, 275],
    'isInPiP': false,
    'useNativePiP': true,
    'fullscreenEnabled': false,
    'selectedDisplay': 0,
    'overlayText': 'Now Playing',
    'overlayPosition': 'bottom-left',
    'overlayFontSize': 24,
    'overlayOpacity': 0.8,
  } as PictureInPicturePluginConfig,
  stylesheets: [style],
  menu: onMenu,

  backend: {
    start: onMainLoad,
    onConfigChange,
  },
  renderer: {
    onPlayerApiReady,
  },
});
