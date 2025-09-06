// Types for timeline ownership, master clock, and seek contracts
// Renderer owns the master timeline; plugins provide relative timelines or seek functions.

export interface MediaTimeProvider {
  // Returns media time in seconds
  now(): number;
}

export interface MasterClock extends MediaTimeProvider {
  fps?: number;
  snapToFrame?: boolean;
}

export type SeekFunction = (_timeSec: number) => void;

export interface TimelineControllerApi {
  play(): void;
  pause(): void;
  seek(_timeSec: number): void;
  setRate(_rate: number): void; // playback rate
  onTick(_cb: (_timeSec: number) => void): () => void; // returns unsubscribe
}
