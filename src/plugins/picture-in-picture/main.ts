import { app, screen, BrowserWindow } from 'electron';

import type { PictureInPicturePluginConfig } from './index';

import type { BackendContext } from '@/types/contexts';

let config: PictureInPicturePluginConfig;
let fullscreenWindow: BrowserWindow | null = null;
let overlayConfigWindow: BrowserWindow | null = null;

const createFullscreenWindow = (mainWindow: BrowserWindow) => {
  if (fullscreenWindow) {
    fullscreenWindow.destroy();
  }

  const displays = screen.getAllDisplays();
  const targetDisplay = displays[config.selectedDisplay] || displays[0];

  fullscreenWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Create fullscreen player HTML content
  const fullscreenHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fullscreen Player</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                background: #000;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                overflow: hidden;
                cursor: none;
            }
            
            #player-container {
                width: 100vw;
                height: 100vh;
                position: relative;
            }
            
            #video-frame {
                width: 100%;
                height: 100%;
                border: none;
                background: #000;
            }
            
            #text-overlay {
                position: absolute;
                z-index: 1000;
                padding: 16px 24px;
                border-radius: 8px;
                font-weight: 500;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                white-space: nowrap;
                transition: opacity 0.3s ease;
                pointer-events: none;
                backdrop-filter: blur(4px);
                font-size: ${config.overlayFontSize}px;
                opacity: ${config.overlayOpacity};
                background: rgba(0, 0, 0, ${config.overlayOpacity});
                color: white;
            }
            
            #text-overlay.top-left { top: 40px; left: 40px; }
            #text-overlay.top-right { top: 40px; right: 40px; }
            #text-overlay.bottom-left { bottom: 40px; left: 40px; }
            #text-overlay.bottom-right { bottom: 40px; right: 40px; }
            
            #text-overlay.hidden {
                opacity: 0;
            }

            body.show-cursor {
                cursor: default;
            }
        </style>
    </head>
    <body>
        <div id="player-container">
            <iframe id="video-frame" src="${mainWindow.webContents.getURL()}"></iframe>
            ${config.overlayText ? `<div id="text-overlay" class="${config.overlayPosition}">${config.overlayText}</div>` : ''}
        </div>
        
        <script>
            let cursorTimer = null;
            
            // Show cursor temporarily on mouse movement
            document.addEventListener('mousemove', () => {
                document.body.classList.add('show-cursor');
                
                if (cursorTimer) clearTimeout(cursorTimer);
                cursorTimer = setTimeout(() => {
                    document.body.classList.remove('show-cursor');
                }, 3000);
            });
            
            // Handle escape key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    window.close();
                }
            });
            
            // Prevent context menu
            document.addEventListener('contextmenu', (e) => e.preventDefault());
        </script>
    </body>
    </html>
  `;

  fullscreenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullscreenHTML)}`);

  fullscreenWindow.on('closed', () => {
    fullscreenWindow = null;
  });

  fullscreenWindow.show();
};

const createOverlayConfigWindow = (mainWindow: BrowserWindow) => {
  if (overlayConfigWindow && !overlayConfigWindow.isDestroyed()) {
    overlayConfigWindow.focus();
    return;
  }

  overlayConfigWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 600,
    height: 700,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const overlayConfigHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configure Text Overlay</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 24px;
                background: #f8f9fa;
                margin: 0;
            }
            
            .config-container {
                max-width: 500px;
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            h2 {
                margin: 0 0 20px 0;
                color: #1a1a1a;
                font-size: 20px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            label {
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #333;
                font-size: 14px;
            }
            
            input, select, textarea {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 6px;
                font-size: 14px;
                transition: border-color 0.2s;
            }
            
            input:focus, select:focus, textarea:focus {
                outline: none;
                border-color: #007AFF;
            }
            
            textarea {
                height: 80px;
                resize: vertical;
                font-family: inherit;
            }
            
            .range-group {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .range-group input[type="range"] {
                flex: 1;
            }
            
            .range-value {
                min-width: 40px;
                text-align: center;
                font-weight: 500;
                color: #666;
            }
            
            .button-group {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 32px;
                padding-top: 20px;
                border-top: 1px solid #e1e5e9;
            }
            
            button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .btn-primary {
                background: #007AFF;
                color: white;
            }
            
            .btn-primary:hover {
                background: #0056b3;
            }
            
            .btn-secondary {
                background: #f0f0f0;
                color: #333;
            }
            
            .btn-secondary:hover {
                background: #e0e0e0;
            }
            
            .preview {
                margin-top: 16px;
                padding: 12px;
                background: #000;
                border-radius: 6px;
                position: relative;
                min-height: 60px;
            }
            
            .preview-text {
                position: absolute;
                color: white;
                white-space: nowrap;
            }
        </style>
    </head>
    <body>
        <div class="config-container">
            <h2>Configure Text Overlay</h2>
            
            <form id="overlay-form">
                <div class="form-group">
                    <label for="text">Overlay Text:</label>
                    <textarea id="text" name="text" placeholder="Enter your overlay text...">${config.overlayText || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="position">Position:</label>
                    <select id="position" name="position">
                        <option value="top-left" ${config.overlayPosition === 'top-left' ? 'selected' : ''}>Top Left</option>
                        <option value="top-right" ${config.overlayPosition === 'top-right' ? 'selected' : ''}>Top Right</option>
                        <option value="bottom-left" ${config.overlayPosition === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                        <option value="bottom-right" ${config.overlayPosition === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="fontSize">Font Size:</label>
                    <div class="range-group">
                        <input type="range" id="fontSize" name="fontSize" min="12" max="72" value="${config.overlayFontSize || 24}">
                        <span class="range-value" id="fontSize-value">${config.overlayFontSize || 24}px</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="opacity">Opacity:</label>
                    <div class="range-group">
                        <input type="range" id="opacity" name="opacity" min="0" max="1" step="0.1" value="${config.overlayOpacity || 0.8}">
                        <span class="range-value" id="opacity-value">${config.overlayOpacity || 0.8}</span>
                    </div>
                </div>
                
                <div class="preview" id="preview">
                    <div class="preview-text ${config.overlayPosition || 'bottom-left'}" id="preview-text">${config.overlayText || 'Sample overlay text'}</div>
                </div>
            </form>
            
            <div class="button-group">
                <button type="button" class="btn-secondary" onclick="window.close()">Cancel</button>
                <button type="button" class="btn-primary" onclick="saveConfig()">Save</button>
            </div>
        </div>
        
        <script>
            function updatePreview() {
                const preview = document.getElementById('preview-text');
                const text = document.getElementById('text').value || 'Sample overlay text';
                const position = document.getElementById('position').value;
                const fontSize = document.getElementById('fontSize').value;
                const opacity = document.getElementById('opacity').value;
                
                preview.textContent = text;
                preview.className = 'preview-text ' + position;
                preview.style.fontSize = fontSize + 'px';
                preview.style.opacity = opacity;
                
                document.getElementById('fontSize-value').textContent = fontSize + 'px';
                document.getElementById('opacity-value').textContent = opacity;
            }
            
            function saveConfig() {
                const newConfig = {
                    overlayText: document.getElementById('text').value,
                    overlayPosition: document.getElementById('position').value,
                    overlayFontSize: parseInt(document.getElementById('fontSize').value),
                    overlayOpacity: parseFloat(document.getElementById('opacity').value)
                };
                
                // Send config to main process via window.electronAPI if available
                if (window.electronAPI && window.electronAPI.saveOverlayConfig) {
                    window.electronAPI.saveOverlayConfig(newConfig);
                }
                
                window.close();
            }
            
            // Update preview on any change
            document.getElementById('overlay-form').addEventListener('input', updatePreview);
            document.getElementById('overlay-form').addEventListener('change', updatePreview);
            
            // Initial preview update
            updatePreview();
        </script>
    </body>
    </html>
  `;

  overlayConfigWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayConfigHTML)}`);

  overlayConfigWindow.on('closed', () => {
    overlayConfigWindow = null;
  });

  overlayConfigWindow.show();
};

const getDisplaysInfo = () => {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  
  return displays.map((display, index) => ({
    id: index,
    label: `Display ${index + 1} (${display.bounds.width}x${display.bounds.height})${display.id === primaryDisplay.id ? ' - Primary' : ''}`,
    bounds: display.bounds,
    isPrimary: display.id === primaryDisplay.id
  }));
};

const toggleFullscreenPlayer = (mainWindow: BrowserWindow) => {
  if (fullscreenWindow) {
    fullscreenWindow.destroy();
    fullscreenWindow = null;
  } else if (config.fullscreenEnabled && config.isInPiP) {
    createFullscreenWindow(mainWindow);
  }
};

export const onMainLoad = async ({
  window,
  getConfig,
  setConfig,
  ipc: { send, on },
}: BackendContext<PictureInPicturePluginConfig>) => {
  let isInPiP = false;
  let originalPosition: number[];
  let originalSize: number[];
  let originalFullScreen: boolean;
  let originalMaximized: boolean;

  const pipPosition = () =>
    (config.savePosition && config['pip-position']) || [10, 10];
  const pipSize = () => (config.saveSize && config['pip-size']) || [450, 275];

  const togglePiP = () => {
    isInPiP = !isInPiP;
    setConfig({ isInPiP });

    if (isInPiP) {
      originalFullScreen = window.isFullScreen();
      if (originalFullScreen) {
        window.setFullScreen(false);
      }

      originalMaximized = window.isMaximized();
      if (originalMaximized) {
        window.unmaximize();
      }

      originalPosition = window.getPosition();
      originalSize = window.getSize();

      window.webContents.addListener('before-input-event', blockShortcutsInPiP);

      window.setMaximizable(false);
      window.setFullScreenable(false);

      send('ytmd:pip-toggle', true);

      app.dock?.hide();
      window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
      app.dock?.show();
      if (config.alwaysOnTop) {
        window.setAlwaysOnTop(true, 'screen-saver', 1);
      }
    } else {
      window.webContents.removeListener(
        'before-input-event',
        blockShortcutsInPiP,
      );
      window.setMaximizable(true);
      window.setFullScreenable(true);

      send('ytmd:pip-toggle', false);

      window.setVisibleOnAllWorkspaces(false);
      window.setAlwaysOnTop(false);

      if (originalFullScreen) {
        window.setFullScreen(true);
      }

      if (originalMaximized) {
        window.maximize();
      }
    }

    const [x, y] = isInPiP ? pipPosition() : originalPosition;
    const [w, h] = isInPiP ? pipSize() : originalSize;
    window.setPosition(x, y);
    window.setSize(w, h);

    window.setWindowButtonVisibility?.(!isInPiP);
  };

  const blockShortcutsInPiP = (
    event: Electron.Event,
    input: Electron.Input,
  ) => {
    const key = input.key.toLowerCase();

    if (key === 'f') {
      event.preventDefault();
    } else if (key === 'escape') {
      togglePiP();
      event.preventDefault();
    }
  };

  config ??= await getConfig();
  setConfig({ isInPiP });
  on('plugin:toggle-picture-in-picture', () => {
    togglePiP();
  });

  on('plugin:toggle-fullscreen-player', () => {
    toggleFullscreenPlayer(window);
  });

  // Add new IPC handlers for display and overlay management
  on('pip:get-displays', () => {
    return getDisplaysInfo();
  });

  on('pip:set-display', async (displayId: number) => {
    setConfig({ selectedDisplay: displayId });
    return true;
  });

  on('pip:configure-overlay', () => {
    createOverlayConfigWindow(window);
  });

  on('pip:save-overlay-config', async (overlayConfig: any) => {
    setConfig({
      overlayText: overlayConfig.overlayText,
      overlayPosition: overlayConfig.overlayPosition,
      overlayFontSize: overlayConfig.overlayFontSize,
      overlayOpacity: overlayConfig.overlayOpacity
    });
    
    // If fullscreen window is open, recreate it with new overlay settings
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
      fullscreenWindow.destroy();
      fullscreenWindow = null;
      if (config.fullscreenEnabled && config.isInPiP) {
        createFullscreenWindow(window);
      }
    }
    
    return true;
  });

  on('pip:toggle-fullscreen-mode', () => {
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
      fullscreenWindow.destroy();
      fullscreenWindow = null;
      setConfig({ fullscreenEnabled: false });
    } else if (config.isInPiP) {
      setConfig({ fullscreenEnabled: true });
      createFullscreenWindow(window);
    }
  });

  window.on('move', () => {
    if (config.isInPiP && !config.useNativePiP) {
      const [x, y] = window.getPosition();
      setConfig({ 'pip-position': [x, y] });
    }
  });

  window.on('resize', () => {
    if (config.isInPiP && !config.useNativePiP) {
      const [width, height] = window.getSize();
      setConfig({ 'pip-size': [width, height] });
    }
  });
};

export const onConfigChange = (newConfig: PictureInPicturePluginConfig) => {
  const prevConfig = config;
  config = newConfig;
  
  // Check if we need to update fullscreen window based on config changes
  if (prevConfig && (
    prevConfig.fullscreenEnabled !== newConfig.fullscreenEnabled ||
    prevConfig.selectedDisplay !== newConfig.selectedDisplay ||
    prevConfig.overlayText !== newConfig.overlayText ||
    prevConfig.overlayPosition !== newConfig.overlayPosition ||
    prevConfig.overlayFontSize !== newConfig.overlayFontSize ||
    prevConfig.overlayOpacity !== newConfig.overlayOpacity
  )) {
    if (newConfig.isInPiP && newConfig.fullscreenEnabled && fullscreenWindow) {
      // Note: We would need access to the main window here to recreate
      // For now, just close and let user manually reopen
      fullscreenWindow.destroy();
      fullscreenWindow = null;
    } else if (!newConfig.fullscreenEnabled && fullscreenWindow) {
      // Close fullscreen window if disabled
      fullscreenWindow.destroy();
      fullscreenWindow = null;
    }
  }
};
