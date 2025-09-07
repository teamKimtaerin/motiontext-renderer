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
        currentTime: 0
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
        currentTime: 0
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