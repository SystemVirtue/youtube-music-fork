import prompt from 'custom-electron-prompt';

import promptOptions from '@/providers/prompt-options';

import { t } from '@/i18n';

import type { PictureInPicturePluginConfig } from './index';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export const onMenu = async ({
  window,
  getConfig,
  setConfig,
}: MenuContext<PictureInPicturePluginConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: t('plugins.picture-in-picture.menu.always-on-top'),
      type: 'checkbox',
      checked: config.alwaysOnTop,
      click(item) {
        setConfig({ alwaysOnTop: item.checked });
        window.setAlwaysOnTop(item.checked);
      },
    },
    {
      label: t('plugins.picture-in-picture.menu.save-window-position'),
      type: 'checkbox',
      checked: config.savePosition,
      click(item) {
        setConfig({ savePosition: item.checked });
      },
    },
    {
      label: t('plugins.picture-in-picture.menu.save-window-size'),
      type: 'checkbox',
      checked: config.saveSize,
      click(item) {
        setConfig({ saveSize: item.checked });
      },
    },
    {
      label: t('plugins.picture-in-picture.menu.hotkey.label'),
      type: 'checkbox',
      checked: !!config.hotkey,
      async click(item) {
        const output = await prompt(
          {
            title: t('plugins.picture-in-picture.menu.prompt.title'),
            label: t('plugins.picture-in-picture.menu.prompt.label'),
            type: 'keybind',
            keybindOptions: [
              {
                value: 'hotkey',
                label: t(
                  'plugins.picture-in-picture.menu.prompt.keybind-options.hotkey',
                ),
                default: config.hotkey,
              },
            ],
            ...promptOptions(),
          },
          window,
        );

        if (output) {
          const { value, accelerator } = output[0];
          setConfig({ [value]: accelerator });

          item.checked = !!accelerator;
        } else {
          // Reset checkbox if prompt was canceled
          item.checked = !item.checked;
        }
      },
    },
    {
      label: t('plugins.picture-in-picture.menu.use-native-pip'),
      type: 'checkbox',
      checked: config.useNativePiP,
      click(item) {
        setConfig({ useNativePiP: item.checked });
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Fullscreen Player',
      type: 'checkbox',
      checked: config.fullscreenEnabled,
      click(item) {
        setConfig({ fullscreenEnabled: item.checked });
        // Send IPC message to toggle fullscreen mode
        window.webContents.send('pip:toggle-fullscreen-mode');
      },
    },
    {
      label: 'Select Display',
      async click() {
        // Request displays from main process
        try {
          const displays = await window.webContents.executeJavaScript(`
            new Promise((resolve) => {
              if (window.electronAPI && window.electronAPI.invoke) {
                window.electronAPI.invoke('pip:get-displays').then(resolve);
              } else {
                // Fallback: prompt user for display number
                resolve([
                  { id: 0, label: 'Display 1 (Primary)' },
                  { id: 1, label: 'Display 2 (Secondary)' }
                ]);
              }
            })
          `);

          let displayOptions = 'Available displays:\n\n';
          displays.forEach((display: any) => {
            displayOptions += `${display.id}: ${display.label}\n`;
          });

          const output = await prompt(
            {
              title: 'Select Display',
              label: `${displayOptions}\nEnter display number:`,
              type: 'input',
              inputAttrs: { type: 'number', min: '0', max: displays.length.toString() },
              value: config.selectedDisplay.toString(),
              ...promptOptions(),
            },
            window,
          );

          if (output !== null && output !== undefined) {
            const displayIndex = parseInt(output);
            if (!isNaN(displayIndex) && displayIndex >= 0 && displayIndex < displays.length) {
              setConfig({ selectedDisplay: displayIndex });
              // Send IPC message to update display
              window.webContents.send('pip:set-display', displayIndex);
            }
          }
        } catch (error) {
          console.error('Failed to get displays:', error);
          
          // Fallback prompt
          const output = await prompt(
            {
              title: 'Select Display',
              label: 'Enter display number (0 for primary, 1+ for secondary):',
              type: 'input',
              inputAttrs: { type: 'number', min: '0', max: '10' },
              value: config.selectedDisplay.toString(),
              ...promptOptions(),
            },
            window,
          );

          if (output !== null && output !== undefined) {
            const displayIndex = parseInt(output);
            if (!isNaN(displayIndex) && displayIndex >= 0) {
              setConfig({ selectedDisplay: displayIndex });
              window.webContents.send('pip:set-display', displayIndex);
            }
          }
        }
      },
    },
    {
      label: 'Configure Overlay',
      click() {
        // Send IPC message to open overlay configuration
        window.webContents.send('pip:configure-overlay');
      },
    },
  ];
};
