import { describe, it, expect } from 'vitest';
import { TimelineController } from '../TimelineController';

describe('M5.6: TimelineController', () => {
  describe('Event listener leak prevention', () => {
    it('should remove all event listeners after detachMedia', () => {
      const timeline = new TimelineController();

      // Create mock video with event listener tracking
      const eventListeners = new Map<string, Set<Function>>();
      const mockVideo = {
        addEventListener: (event: string, fn: Function) => {
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set());
          }
          eventListeners.get(event)!.add(fn);
        },
        removeEventListener: (event: string, fn: Function) => {
          eventListeners.get(event)?.delete(fn);
        },
        currentTime: 0,
      } as any;

      // Attach media - should register listeners
      timeline.attachMedia(mockVideo);

      // Verify listeners were registered
      expect(eventListeners.get('timeupdate')?.size).toBe(1);
      expect(eventListeners.get('seeked')?.size).toBe(1);
      expect(eventListeners.get('loadedmetadata')?.size).toBe(1);
      expect(eventListeners.get('ratechange')?.size).toBe(1);
      expect(eventListeners.get('play')?.size).toBe(1);
      expect(eventListeners.get('pause')?.size).toBe(1);

      // Detach media - should remove all listeners
      timeline.detachMedia();

      // Verify all listeners were removed
      expect(eventListeners.get('timeupdate')?.size).toBe(0);
      expect(eventListeners.get('seeked')?.size).toBe(0);
      expect(eventListeners.get('loadedmetadata')?.size).toBe(0);
      expect(eventListeners.get('ratechange')?.size).toBe(0);
      expect(eventListeners.get('play')?.size).toBe(0);
      expect(eventListeners.get('pause')?.size).toBe(0);
    });

    it('should not accumulate listeners on re-attach', () => {
      const timeline = new TimelineController();

      // Track listener counts
      const listenerCounts = new Map<string, number>();
      const mockVideo = {
        addEventListener: (event: string) => {
          listenerCounts.set(event, (listenerCounts.get(event) || 0) + 1);
        },
        removeEventListener: (event: string) => {
          listenerCounts.set(event, (listenerCounts.get(event) || 0) - 1);
        },
        currentTime: 0,
      } as any;

      // First attach
      timeline.attachMedia(mockVideo);
      expect(listenerCounts.get('timeupdate')).toBe(1);

      // Second attach (should detach first)
      timeline.attachMedia(mockVideo);

      // Should have net 1 listener (1 removed, 1 added)
      expect(listenerCounts.get('timeupdate')).toBe(1);
      expect(listenerCounts.get('seeked')).toBe(1);
      expect(listenerCounts.get('loadedmetadata')).toBe(1);
      expect(listenerCounts.get('ratechange')).toBe(1);
      expect(listenerCounts.get('play')).toBe(1);
      expect(listenerCounts.get('pause')).toBe(1);
    });

    it('should handle detachMedia without prior attachMedia', () => {
      const timeline = new TimelineController();

      // Should not throw
      expect(() => timeline.detachMedia()).not.toThrow();
    });
  });
});

describe('M6: TimelineController rVFC loop', () => {
  it('should tick using rVFC mediaTime when available', () => {
    const timeline = new TimelineController();

    // Capture registered listeners
    const listeners = new Map<string, Function[]>();
    const push = (k: string, fn: Function) => {
      const a = listeners.get(k) || [];
      a.push(fn);
      listeners.set(k, a);
    };

    let vfcCb: any = null;
    let vfcNextId = 1;
    const mockVideo: any = {
      currentTime: 0,
      playbackRate: 1,
      addEventListener: (event: string, fn: Function) => push(event, fn),
      removeEventListener: () => {},
      requestVideoFrameCallback: (cb: any) => {
        vfcCb = cb;
        return vfcNextId++;
      },
      cancelVideoFrameCallback: () => {},
    };

    timeline.attachMedia(mockVideo);
    const ticks: number[] = [];
    const unsub = timeline.onTick((t) => ticks.push(t));

    timeline.play();

    // Simulate one video frame callback
    vfcCb?.(0, { mediaTime: 1.234 });

    expect(ticks.at(-1)).toBeCloseTo(1.234, 6);

    // Pause should stop further callbacks from publishing
    timeline.pause();
    const before = ticks.length;
    vfcCb?.(0, { mediaTime: 2.0 });
    expect(ticks.length).toBe(before);

    unsub();
    timeline.detachMedia();
  });

  it('should notify on seek while paused and support setRate', () => {
    const timeline = new TimelineController();
    const listeners = new Map<string, Function[]>();
    const push = (k: string, fn: Function) => {
      const a = listeners.get(k) || [];
      a.push(fn);
      listeners.set(k, a);
    };
    const mockVideo: any = {
      currentTime: 0,
      playbackRate: 1,
      addEventListener: (event: string, fn: Function) => push(event, fn),
      removeEventListener: () => {},
    };
    timeline.attachMedia(mockVideo);
    const ticks: number[] = [];
    timeline.onTick((t) => ticks.push(t));

    // Seek while paused
    mockVideo.currentTime = 5.5;
    listeners.get('seeked')?.forEach((fn) => fn());
    expect(ticks.at(-1)).toBeCloseTo(5.5, 6);

    // setRate updates playbackRate
    timeline.setRate(1.5);
    expect(mockVideo.playbackRate).toBeCloseTo(1.5);

    timeline.detachMedia();
  });

  it('should pause on ended event', () => {
    const timeline = new TimelineController();
    const listeners = new Map<string, Function[]>();
    const push = (k: string, fn: Function) => {
      const a = listeners.get(k) || [];
      a.push(fn);
      listeners.set(k, a);
    };
    let vfcCb: any = null;
    const mockVideo: any = {
      currentTime: 0,
      addEventListener: (event: string, fn: Function) => push(event, fn),
      removeEventListener: () => {},
      requestVideoFrameCallback: (cb: any) => {
        vfcCb = cb;
        return 1;
      },
      cancelVideoFrameCallback: () => {},
    };
    timeline.attachMedia(mockVideo);
    const ticks: number[] = [];
    timeline.onTick((t) => ticks.push(t));
    timeline.play();

    // fire one frame
    vfcCb?.(0, { mediaTime: 0.1 });
    const before = ticks.length;

    // fire ended
    listeners.get('ended')?.forEach((fn) => fn());

    // frame after ended should not publish
    vfcCb?.(0, { mediaTime: 0.2 });
    expect(ticks.length).toBe(before);

    timeline.detachMedia();
  });
});

describe('M6+: TimelineController rVFC edge cases', () => {
  function createMockVideo() {
    const listeners = new Map<string, Function[]>();
    let nextId = 1;
    const scheduled: { id: number; cb: any }[] = [];
    const canceled: number[] = [];
    const mock: any = {
      currentTime: 0,
      playbackRate: 1,
      addEventListener: (event: string, fn: Function) => {
        const arr = listeners.get(event) || [];
        arr.push(fn);
        listeners.set(event, arr);
      },
      removeEventListener: (event: string, fn: Function) => {
        const arr = listeners.get(event) || [];
        const i = arr.indexOf(fn as any);
        if (i >= 0) arr.splice(i, 1);
        listeners.set(event, arr);
      },
      requestVideoFrameCallback: (cb: any) => {
        const id = nextId++;
        scheduled.push({ id, cb });
        return id;
      },
      cancelVideoFrameCallback: (id: number) => {
        canceled.push(id);
      },
      __listeners: listeners,
      __scheduled: scheduled,
      __canceled: canceled,
    };
    return mock;
  }

  it('ignores stale vFC callbacks using generation token', () => {
    const tl = new TimelineController();
    const video = createMockVideo();
    tl.attachMedia(video as any);
    const ticks: number[] = [];
    tl.onTick((t) => ticks.push(t));

    // Start playback → initial schedule (cb1)
    tl.play();
    const cb1 = video.__scheduled.at(-1)!.cb;

    // Seek while running → reschedule (cb2), cancel previous
    video.__listeners.get('seeked')?.forEach((fn: any) => fn());
    const cb2 = video.__scheduled.at(-1)!.cb;

    // Fire old callback (stale) → should be ignored (no change from baseline)
    const base = ticks.length; // seek handler may have notified once
    cb1(0, { mediaTime: 1.0 });
    expect(ticks.length).toBe(base);

    // Fire current callback → should publish exactly one new tick
    const before2 = ticks.length;
    cb2(0, { mediaTime: 2.5 });
    expect(ticks.length).toBe(before2 + 1);
    expect(ticks.at(-1)).toBeCloseTo(2.5, 6);
  });

  it('does not schedule vFC when seeking while paused', () => {
    const tl = new TimelineController();
    const video = createMockVideo();
    tl.attachMedia(video as any);
    tl.play();
    tl.pause();
    const before = video.__scheduled.length;

    // While paused, seeked should not schedule (running=false)
    video.__listeners.get('seeked')?.forEach((fn: any) => fn());
    expect(video.__scheduled.length).toBe(before);
  });

  it('cancels prior vFC reservation when rescheduling on seek', () => {
    const tl = new TimelineController();
    const video = createMockVideo();
    tl.attachMedia(video as any);
    tl.play();
    const firstId = video.__scheduled.at(-1)!.id;

    // Trigger reschedule
    video.__listeners.get('seeked')?.forEach((fn: any) => fn());

    // Expect cancel called with previous id
    expect(video.__canceled).toContain(firstId);
    // And a new schedule exists
    expect(video.__scheduled.at(-1)!.id).not.toBe(firstId);
  });
});
