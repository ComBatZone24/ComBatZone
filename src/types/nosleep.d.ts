// Since @types/nosleep.js does not exist, we create our own declaration file.
// This tells TypeScript what the NoSleep object looks like.

declare module 'nosleep.js' {
  class NoSleep {
    constructor();
    enable(): void;
    disable(): void;
    _addSourceToVideo(element: HTMLVideoElement, type: 'webm' | 'mp4'): void;
    _preventLock(eventType: string): void;
    readonly isEnabled: boolean;
  }
  export default NoSleep;
}
