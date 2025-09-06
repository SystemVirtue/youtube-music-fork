import { createPlugin } from '@/utils';

import { t } from '@/i18n';

import type { YoutubePlayer } from '@/types/youtube-player';

export type PauseConfirmationPluginConfig = {
  enabled: boolean;
  disablePlayerEvents: boolean;
};

export default createPlugin<
  unknown,
  unknown,
  {
    config: PauseConfirmationPluginConfig | null;
    api: YoutubePlayer | null;
    isShowingPopover: boolean;
    originalPauseVideo: (() => void) | null;
    originalPlayVideo: (() => void) | null;
    keydownHandler: (event: KeyboardEvent) => void;
    clickHandler: (event: Event) => void;
    showPauseConfirmation: () => Promise<boolean>;
    createPopover: () => HTMLElement;
    removePopover: () => void;
    enablePauseConfirmation: () => void;
    disablePauseConfirmation: () => void;
    mutationObserver: MutationObserver | null;
    originalPolymerHandler: ((event: Event) => void) | null;
    overrideNativeHandling: () => void;
  },
  PauseConfirmationPluginConfig
>({
  name: () => t('plugins.pause-confirmation.name'),
  description: () => t('plugins.pause-confirmation.description'),
  restartNeeded: false,
  config: {
    enabled: false,
    disablePlayerEvents: false,
  },
  menu: async ({ getConfig, setConfig }) => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.pause-confirmation.menu.disable-player-events'),
        type: 'checkbox',
        checked: config.disablePlayerEvents,
        async click() {
          const nowConfig = await getConfig();
          setConfig({
            disablePlayerEvents: !nowConfig.disablePlayerEvents,
          });
        },
      },
    ];
  },
  renderer: {
    config: null,
    api: null,
    isShowingPopover: false,
    originalPauseVideo: null,
    originalPlayVideo: null,
    mutationObserver: null,
    originalPolymerHandler: null,
    
    keydownHandler(event: KeyboardEvent) {
      // Intercept spacebar pause
      if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const activeElement = document.activeElement;
        const isInInput = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        if (!isInInput && this.api && this.api.getPlayerState() === 1) { // Playing state
          event.preventDefault();
          event.stopPropagation();
          this.showPauseConfirmation().then(confirmed => {
            if (confirmed && this.originalPauseVideo) {
              this.originalPauseVideo.call(this.api);
            }
          });
        }
      }
    },

    clickHandler(event: Event) {
      // Intercept clicks on play/pause button and video
      const target = event.target as HTMLElement;
      
      // Comprehensive YouTube player button selectors
      const playButtonSelectors = [
        '#play-pause-button',
        '.ytp-play-button',
        '.ytp-chrome-top .ytp-button',
        '.ytp-small-mode .ytp-chrome-controls .ytp-button',
        '.ytp-small-mode .ytp-replay-button',
        '[data-title-no-tooltip="Pause"]',
        '[data-title-no-tooltip="Play"]',
        '.ytp-large-play-button',
        '.ytp-button[data-tooltip-target-id*="play"]',
        '.ytp-button[aria-label*="Play"]',
        '.ytp-button[aria-label*="Pause"]'
      ];
      
      // Video player area selectors - YouTube Music specific
      const videoSelectors = [
        'video',
        '#movie_player',
        '.video-stream',
        '.html5-video-player',
        '.html5-main-video',
        '.ytp-chrome-bottom',
        '.ytp-chrome-controls',
        '.ytp-cued-thumbnail-overlay',
        '.ytp-large-play-button-red-bg',
        '.ytp-player-content',
        '.ytp-iv-video-content',
        'ytmusic-player-page',
        'ytmusic-player',
        '#player'
      ];
      
      // Check if click is on any play/pause button
      let isPlayButtonClick = false;
      for (const selector of playButtonSelectors) {
        const element = document.querySelector(selector);
        if (element && (element.contains(target) || target === element)) {
          isPlayButtonClick = true;
          break;
        }
      }
      
      // Check if click is on video player area
      let isVideoPlayerClick = false;
      for (const selector of videoSelectors) {
        const element = document.querySelector(selector);
        if (element && (element.contains(target) || target === element)) {
          isVideoPlayerClick = true;
          break;
        }
      }
      
      // If disablePlayerEvents is enabled, ignore video player clicks but still handle play button clicks
      if (this.config?.disablePlayerEvents && isVideoPlayerClick && !isPlayButtonClick) {
        // Prevent the click from doing anything - no pause, no popup
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return; // Block video player clicks when disabled
      }
      
      if (isPlayButtonClick || isVideoPlayerClick) {
        if (this.api && this.api.getPlayerState() === 1) { // Playing state
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          this.showPauseConfirmation().then(confirmed => {
            if (confirmed && this.originalPauseVideo) {
              this.originalPauseVideo.call(this.api);
            }
          });
        }
      }
    },

    async showPauseConfirmation(): Promise<boolean> {
      if (this.isShowingPopover) return false;
      
      this.isShowingPopover = true;
      
      return new Promise((resolve) => {
        const popover = this.createPopover();
        document.body.appendChild(popover);
        
        const yesButton = popover.querySelector('.pause-confirm-yes') as HTMLButtonElement;
        const cancelButton = popover.querySelector('.pause-confirm-cancel') as HTMLButtonElement;
        
        const cleanup = () => {
          this.removePopover();
          this.isShowingPopover = false;
        };
        
        const handleYes = () => {
          cleanup();
          resolve(true);
        };
        
        const handleCancel = () => {
          cleanup();
          resolve(false);
        };
        
        const handleClickOutside = (event: Event) => {
          if (!popover.contains(event.target as Node)) {
            document.removeEventListener('click', handleClickOutside);
            handleCancel();
          }
        };
        
        yesButton.addEventListener('click', handleYes);
        cancelButton.addEventListener('click', handleCancel);
        
        // Handle click outside after a short delay to avoid immediate closure
        setTimeout(() => {
          document.addEventListener('click', handleClickOutside);
        }, 100);
        
        // Handle Escape key
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            document.removeEventListener('keydown', handleEscape);
            handleCancel();
          }
        };
        document.addEventListener('keydown', handleEscape);
      });
    },

    createPopover(): HTMLElement {
      const popover = document.createElement('div');
      popover.className = 'pause-confirmation-popover';
      popover.innerHTML = `
        <div class="pause-confirmation-content">
          <div class="pause-confirmation-text">${t('plugins.pause-confirmation.message')}</div>
          <div class="pause-confirmation-buttons">
            <button class="pause-confirm-yes">${t('plugins.pause-confirmation.yes')}</button>
            <button class="pause-confirm-cancel">${t('plugins.pause-confirmation.cancel')}</button>
          </div>
        </div>
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .pause-confirmation-popover {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border: 2px solid #ff6b35;
          border-radius: 12px;
          padding: 20px;
          z-index: 10000;
          font-family: 'YouTube Sans', 'Roboto', sans-serif;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        
        .pause-confirmation-content {
          text-align: center;
          color: white;
        }
        
        .pause-confirmation-text {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 20px;
          line-height: 1.4;
        }
        
        .pause-confirmation-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        
        .pause-confirm-yes,
        .pause-confirm-cancel {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 80px;
        }
        
        .pause-confirm-yes {
          background: #ff6b35;
          color: white;
        }
        
        .pause-confirm-yes:hover {
          background: #e55a2b;
          transform: translateY(-1px);
        }
        
        .pause-confirm-cancel {
          background: #333;
          color: white;
          border: 1px solid #666;
        }
        
        .pause-confirm-cancel:hover {
          background: #444;
          transform: translateY(-1px);
        }
      `;
      
      if (!document.querySelector('#pause-confirmation-styles')) {
        style.id = 'pause-confirmation-styles';
        document.head.appendChild(style);
      }
      
      return popover;
    },

    removePopover() {
      const existing = document.querySelector('.pause-confirmation-popover');
      if (existing) {
        existing.remove();
      }
    },

    async start({ getConfig }) {
      this.config = await getConfig();
    },

    onPlayerApiReady(api) {
      this.api = api;
      
      if (this.config?.enabled) {
        this.enablePauseConfirmation();
      }
    },

    enablePauseConfirmation() {
      // Store original methods
      if (this.api) {
        this.originalPauseVideo = this.api.pauseVideo.bind(this.api);
        this.originalPlayVideo = this.api.playVideo.bind(this.api);
      }
      
      // Add event listeners with multiple phases to catch video player clicks
      // Use capturing phase with highest priority to intercept before Polymer gestures
      document.addEventListener('keydown', this.keydownHandler, { capture: true });
      
      // Add multiple event types to catch all possible interactions
      const eventTypes = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
      eventTypes.forEach(eventType => {
        document.addEventListener(eventType, this.clickHandler, { 
          capture: true, 
          passive: false,
          // Use highest priority to intercept before Polymer
        });
      });
      
      // Also add listeners to common video player containers directly with even higher priority
      const videoContainers = ['#movie_player', '.html5-video-player', 'video', 'ytmusic-player-page', 'ytmusic-player', '#player'];
      videoContainers.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          eventTypes.forEach(eventType => {
            element.addEventListener(eventType, this.clickHandler, { 
              capture: true, 
              passive: false 
            });
          });
        }
      });
      
      // Override native event handling if possible
      this.overrideNativeHandling();
      
      // Set up a mutation observer to handle dynamically added video elements
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              videoContainers.forEach(selector => {
                if (node.matches && node.matches(selector)) {
                  eventTypes.forEach(eventType => {
                    node.addEventListener(eventType, this.clickHandler, { 
                      capture: true, 
                      passive: false 
                    });
                  });
                }
                const elements = node.querySelectorAll && node.querySelectorAll(selector);
                if (elements) {
                  elements.forEach(el => {
                    eventTypes.forEach(eventType => {
                      el.addEventListener(eventType, this.clickHandler, { 
                        capture: true, 
                        passive: false 
                      });
                    });
                  });
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      this.mutationObserver = observer;
    },

    overrideNativeHandling() {
      // Try to intercept Polymer gesture handling before it processes events
      try {
        // Look for the Polymer gesture handler in the global scope
        const win = window as any;
        
        // Check if Polymer gestures are available
        if (win.Polymer && win.Polymer.Gestures) {
          const gestures = win.Polymer.Gestures;
          
          // Override the _handleNative function if it exists
          if (gestures._handleNative && typeof gestures._handleNative === 'function') {
            this.originalPolymerHandler = gestures._handleNative.bind(gestures);
            
            gestures._handleNative = (event: Event) => {
              // Check if this is a click event on our video player areas
              const target = event.target as Element;
              if (event.type === 'click' && target) {
                const videoSelectors = [
                  'ytmusic-player-page',
                  'ytmusic-player', 
                  '#player',
                  '#movie_player',
                  '.html5-video-player',
                  'video'
                ];
                
                const isVideoPlayerClick = videoSelectors.some(selector => {
                  const element = document.querySelector(selector);
                  return element && (element.contains(target) || target === element);
                });
                
                if (isVideoPlayerClick && this.config?.disablePlayerEvents) {
                  // Block video player clicks when disabled - prevent any action
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  return;
                }
                
                if (isVideoPlayerClick) {
                  // Intercept and show confirmation for video player clicks
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  this.showPauseConfirmation();
                  return;
                }
              }
              
              // Call original handler for other events
              if (this.originalPolymerHandler) {
                this.originalPolymerHandler(event);
              }
            };
          }
        }
        
        // Also try to override at the document level with even higher priority
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
          if (type === 'click' && this instanceof Element) {
            const videoSelectors = [
              'ytmusic-player-page',
              'ytmusic-player', 
              '#player'
            ];
            
            const isVideoElement = videoSelectors.some(selector => {
              return this.matches && this.matches(selector);
            });
            
            if (isVideoElement) {
              // Wrap the listener to intercept clicks
              const wrappedListener = (event: Event) => {
                const pausePlugin = win.pauseConfirmationPlugin;
                if (pausePlugin && pausePlugin.config?.enabled) {
                  if (pausePlugin.config.disablePlayerEvents) {
                    // Block video player clicks when disabled - prevent any action
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                  }
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  pausePlugin.showPauseConfirmation();
                  return;
                }
                // Call original listener if plugin not active
                if (typeof listener === 'function') {
                  listener.call(this, event);
                } else if (listener && typeof listener.handleEvent === 'function') {
                  listener.handleEvent(event);
                }
              };
              
              return originalAddEventListener.call(this, type, wrappedListener, options);
            }
          }
          
          return originalAddEventListener.call(this, type, listener, options);
        };
        
        // Store reference to this plugin instance globally for the wrapped listeners
        win.pauseConfirmationPlugin = this;
        
      } catch (error) {
        console.warn('Could not override native gesture handling:', error);
      }
    },

    disablePauseConfirmation() {
      // Remove event listeners
      document.removeEventListener('keydown', this.keydownHandler, { capture: true });
      
      // Remove multiple event types
      const eventTypes = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
      eventTypes.forEach(eventType => {
        document.removeEventListener(eventType, this.clickHandler, { capture: true });
      });
      
      // Remove listeners from video containers
      const videoContainers = ['#movie_player', '.html5-video-player', 'video', 'ytmusic-player-page', 'ytmusic-player', '#player'];
      videoContainers.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          eventTypes.forEach(eventType => {
            element.removeEventListener(eventType, this.clickHandler, { capture: true });
          });
        }
      });
      
      // Restore original Polymer handler if we overrode it
      try {
        const win = window as any;
        if (win.Polymer && win.Polymer.Gestures && this.originalPolymerHandler) {
          win.Polymer.Gestures._handleNative = this.originalPolymerHandler;
          this.originalPolymerHandler = null;
        }
        
        // Clean up global reference
        if (win.pauseConfirmationPlugin === this) {
          delete win.pauseConfirmationPlugin;
        }
      } catch (error) {
        console.warn('Could not restore original gesture handling:', error);
      }
      
      // Disconnect mutation observer
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      
      // Remove any existing popover
      this.removePopover();
      this.isShowingPopover = false;
    },

    stop() {
      this.disablePauseConfirmation();
    },

    onConfigChange(newConfig) {
      this.config = newConfig;
      
      if (newConfig.enabled) {
        this.enablePauseConfirmation();
      } else {
        this.disablePauseConfirmation();
      }
    },
  },
});
