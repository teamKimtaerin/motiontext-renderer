import { describe, it, expect, vi } from 'vitest';
import { Stage, computeContentRect } from '../Stage';

describe('M5.6: Stage', () => {
  describe('computeContentRect (pure function)', () => {
    it('should letterbox wide video in tall container', () => {
      // 16:9 video in 4:3 container
      const result = computeContentRect(800, 600, 16/9);
      expect(result).toEqual({
        left: 0,
        top: 75, // (600 - 450) / 2
        width: 800,
        height: 450 // 800 / (16/9)
      });
    });

    it('should pillarbox tall video in wide container', () => {
      // 9:16 video in 16:9 container  
      const result = computeContentRect(1600, 900, 9/16);
      expect(result).toEqual({
        left: 547, // (1600 - 506) / 2
        top: 0,
        width: 506, // 900 * (9/16) = 506.25, rounded
        height: 900
      });
    });

    it('should handle perfect aspect match', () => {
      const result = computeContentRect(1600, 900, 16/9);
      expect(result).toEqual({
        left: 0,
        top: 0,
        width: 1600,
        height: 900
      });
    });

    it('should handle square video', () => {
      const result = computeContentRect(800, 600, 1);
      expect(result).toEqual({
        left: 100, // (800 - 600) / 2 
        top: 0,
        width: 600, // 600 * 1
        height: 600 // 800 / 1 would be 800, but container height is 600
      });
    });
  });

  describe('Stage event subscription', () => {
    it('should call listener on bounds change and stop after unsubscribe', () => {
      const stage = new Stage();
      const listener = vi.fn();
      
      // 1. Subscribe
      const unsub = stage.onBoundsChange(listener);
      
      // 2. Access private method via type assertion for testing
      const stageInternal = stage as any;
      
      // 3. Mock bounds change by calling listeners directly
      stageInternal._boundsChangeListeners.forEach((cb: any) => 
        cb({ left: 0, top: 0, width: 100, height: 100 })
      );
      
      // 4. Verify listener was called
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        left: 0, top: 0, width: 100, height: 100
      });
      
      // 5. Unsubscribe
      unsub();
      
      // 6. Trigger bounds change again
      listener.mockClear();
      stageInternal._boundsChangeListeners.forEach((cb: any) => 
        cb({ left: 0, top: 0, width: 200, height: 200 })
      );
      
      // 7. Verify listener was NOT called after unsubscribe
      expect(listener).toHaveBeenCalledTimes(0);
    });
  });
});