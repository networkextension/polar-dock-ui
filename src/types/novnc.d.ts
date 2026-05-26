// Ambient module declaration for @novnc/novnc.
//
// The package itself ships no .d.ts files (1.7.0). We declare only
// the subset of RFB's API the /console.html pane uses. If the surface
// grows later (clipboard handlers, scaleViewport setters, etc.), add
// them here rather than littering each consumer with `as any`.

declare module "@novnc/novnc" {
  type RFBOptions = {
    shared?: boolean;
    repeaterID?: string;
    credentials?: {
      username?: string;
      password?: string;
      target?: string;
    };
    wsProtocols?: string[];
  };

  export default class RFB {
    constructor(
      target: HTMLElement,
      urlOrWebSocket: string | WebSocket,
      options?: RFBOptions,
    );

    viewOnly: boolean;
    focusOnClick: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    resizeSession: boolean;
    scaleViewport: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;

    disconnect(): void;
    sendCredentials(creds: { username?: string; password?: string; target?: string }): void;
    sendKey(keysym: number, code: string, down?: boolean): void;
    sendCtrlAltDel(): void;
    machineShutdown(): void;
    machineReboot(): void;
    machineReset(): void;
    clipboardPasteFrom(text: string): void;
    focus(): void;
    blur(): void;

    addEventListener(type: string, listener: (ev: CustomEvent) => void): void;
    removeEventListener(type: string, listener: (ev: CustomEvent) => void): void;
  }
}
