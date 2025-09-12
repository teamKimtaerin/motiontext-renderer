import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChannelComposer,
  PluginChannelInterface,
  syncChannelsToDOM,
} from '../ChannelComposer';

describe('ChannelComposer', () => {
  let composer: ChannelComposer;

  beforeEach(() => {
    composer = new ChannelComposer();
  });

  describe('기본 채널 초기화', () => {
    it('표준 채널들이 기본값으로 초기화됨', () => {
      expect(composer.getFinalValue('tx')).toBe(0);
      expect(composer.getFinalValue('ty')).toBe(0);
      expect(composer.getFinalValue('sx')).toBe(1);
      expect(composer.getFinalValue('sy')).toBe(1);
      expect(composer.getFinalValue('rot')).toBe(0);
      expect(composer.getFinalValue('opacity')).toBe(1);
      expect(composer.getFinalValue('filter')).toBe('');
    });

    it('사용 가능한 채널 목록을 반환함', () => {
      const channels = composer.getAvailableChannels();
      expect(channels).toContain('tx');
      expect(channels).toContain('ty');
      expect(channels).toContain('sx');
      expect(channels).toContain('sy');
      expect(channels).toContain('rot');
      expect(channels).toContain('opacity');
      expect(channels).toContain('filter');
    });
  });

  describe('기본값 설정', () => {
    it('렌더러에서 기본 채널 값 설정', () => {
      composer.setBaseValue('tx', 10);
      composer.setBaseValue('opacity', 0.5);

      expect(composer.getFinalValue('tx')).toBe(10);
      expect(composer.getFinalValue('opacity')).toBe(0.5);
    });

    it('새로운 채널을 동적으로 생성', () => {
      composer.setBaseValue('customChannel', 'custom-value');
      
      expect(composer.getFinalValue('customChannel')).toBe('custom-value');
      expect(composer.getAvailableChannels()).toContain('customChannel');
    });
  });

  describe('replace 합성 모드', () => {
    it('기본 replace 모드로 값을 덮어씀', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 20);
      
      expect(composer.getFinalValue('tx')).toBe(20);
    });

    it('여러 replace 합성 시 마지막 값이 적용됨', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 20, 'replace', 1);
      composer.compose('tx', 30, 'replace', 2);
      
      expect(composer.getFinalValue('tx')).toBe(30);
    });

    it('동일 우선순위에서 최신 값으로 교체됨', () => {
      composer.compose('tx', 20, 'replace', 1);
      composer.compose('tx', 30, 'replace', 1); // 같은 우선순위
      
      expect(composer.getFinalValue('tx')).toBe(30);
    });
  });

  describe('add 합성 모드', () => {
    it('숫자 채널에서 덧셈 적용', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add');
      
      expect(composer.getFinalValue('tx')).toBe(15);
    });

    it('여러 add 합성이 누적됨', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add', 1);
      composer.compose('tx', 3, 'add', 2);
      
      expect(composer.getFinalValue('tx')).toBe(18); // 10 + 5 + 3
    });

    it('문자열 채널에서 공백으로 연결', () => {
      composer.setBaseValue('filter', 'blur(2px)');
      composer.compose('filter', 'brightness(1.2)', 'add');
      
      expect(composer.getFinalValue('filter')).toBe('blur(2px) brightness(1.2)');
    });

    it('빈 문자열에서 add는 그대로 설정', () => {
      composer.setBaseValue('filter', '');
      composer.compose('filter', 'blur(2px)', 'add');
      
      expect(composer.getFinalValue('filter')).toBe('blur(2px)');
    });

    it('지원하지 않는 채널에서 warning 출력 후 replace', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      composer.setBaseValue('sx', 1);
      composer.compose('sx', 2, 'add'); // sx는 multiplicative만 지원
      
      expect(composer.getFinalValue('sx')).toBe(2); // replace로 동작
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support additive composition')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('multiply 합성 모드', () => {
    it('숫자 채널에서 곱셈 적용', () => {
      composer.setBaseValue('sx', 2);
      composer.compose('sx', 1.5, 'multiply');
      
      expect(composer.getFinalValue('sx')).toBe(3); // 2 * 1.5
    });

    it('여러 multiply 합성이 누적됨', () => {
      composer.setBaseValue('opacity', 1);
      composer.compose('opacity', 0.8, 'multiply', 1);
      composer.compose('opacity', 0.5, 'multiply', 2);
      
      expect(composer.getFinalValue('opacity')).toBe(0.4); // 1 * 0.8 * 0.5
    });

    it('지원하지 않는 채널에서 warning 출력 후 replace', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 2, 'multiply'); // tx는 additive만 지원
      
      expect(composer.getFinalValue('tx')).toBe(2); // replace로 동작
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support multiplicative composition')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('우선순위 시스템', () => {
    it('낮은 우선순위부터 순서대로 적용', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add', 2); // 나중에 적용
      composer.compose('tx', 3, 'add', 1); // 먼저 적용
      
      expect(composer.getFinalValue('tx')).toBe(18); // 10 + 3 + 5
    });

    it('높은 우선순위가 마지막에 적용됨', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 100, 'replace', 10);
      composer.compose('tx', 5, 'add', 1);
      
      expect(composer.getFinalValue('tx')).toBe(100); // add가 먼저 적용되지만 replace가 덮어씀
    });
  });

  describe('합성 제거', () => {
    it('특정 우선순위의 합성을 제거', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add', 1);
      composer.compose('tx', 3, 'add', 2);
      
      expect(composer.getFinalValue('tx')).toBe(18);
      
      composer.removeComposition('tx', 1);
      expect(composer.getFinalValue('tx')).toBe(13); // 10 + 3
    });
  });

  describe('채널 상태 초기화', () => {
    it('모든 합성을 제거하고 기본값으로 복원', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add', 1);
      composer.compose('opacity', 0.5, 'replace', 1);
      
      composer.reset();
      
      expect(composer.getFinalValue('tx')).toBe(10);
      expect(composer.getFinalValue('opacity')).toBe(1); // 기본값
    });
  });

  describe('getComposedChannels', () => {
    it('모든 채널의 최종 값을 반환', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add');
      composer.compose('opacity', 0.8, 'replace');
      
      const channels = composer.getComposedChannels();
      
      expect(channels.tx).toBe(15);
      expect(channels.opacity).toBe(0.8);
      expect(channels.ty).toBe(0); // 기본값
    });
  });

  describe('디버깅 지원', () => {
    it('채널 상태 정보를 반환', () => {
      composer.setBaseValue('tx', 10);
      composer.compose('tx', 5, 'add', 1);
      composer.compose('tx', 2, 'multiply', 2);
      
      const debugInfo = composer.debugChannelState('tx');
      
      expect(debugInfo).toEqual({
        channel: 'tx',
        baseValue: 10,
        compositions: [
          { value: 5, mode: 'add', priority: 1 },
          { value: 2, mode: 'multiply', priority: 2 },
        ],
        finalValue: 2, // 10 + 5 = 15, but multiply는 tx에서 지원되지 않아 replace로 동작하여 최종값 2
      });
    });
  });
});

describe('PluginChannelInterface', () => {
  let composer: ChannelComposer;
  let interface1: PluginChannelInterface;
  let interface2: PluginChannelInterface;

  beforeEach(() => {
    composer = new ChannelComposer();
    interface1 = new PluginChannelInterface(composer, 'plugin1', 100);
    interface2 = new PluginChannelInterface(composer, 'plugin2', 200);
  });

  describe('플러그인별 채널 조작', () => {
    it('플러그인별로 독립적인 우선순위 할당', () => {
      interface1.set('tx', 10);
      interface2.set('tx', 20);
      
      // plugin2의 우선순위가 더 높으므로 최종 값은 20
      expect(composer.getFinalValue('tx')).toBe(20);
    });

    it('채널 값 가져오기', () => {
      interface1.set('tx', 15);
      
      expect(interface1.get('tx')).toBe(15);
    });

    it('사용 가능한 채널 목록 제공', () => {
      const channels = interface1.available;
      expect(channels).toContain('tx');
      expect(channels).toContain('opacity');
    });
  });

  describe('플러그인 정리', () => {
    it('특정 플러그인의 모든 합성을 제거', () => {
      composer.setBaseValue('tx', 5);
      interface1.set('tx', 10, 'add');
      interface2.set('tx', 3, 'add');
      
      expect(composer.getFinalValue('tx')).toBe(18); // 5 + 10 + 3
      
      interface1.cleanup();
      expect(composer.getFinalValue('tx')).toBe(8); // 5 + 3
    });
  });

  describe('플러그인 ID 해싱', () => {
    it('동일한 플러그인 ID는 동일한 우선순위를 가짐', () => {
      const interface1a = new PluginChannelInterface(composer, 'plugin1', 100);
      const interface1b = new PluginChannelInterface(composer, 'plugin1', 100);
      
      interface1a.set('tx', 10);
      interface1b.set('tx', 20); // 같은 우선순위이므로 덮어씀
      
      expect(composer.getFinalValue('tx')).toBe(20);
    });
  });
});

describe('syncChannelsToDOM', () => {
  let composer: ChannelComposer;
  let element: HTMLElement;

  beforeEach(() => {
    composer = new ChannelComposer();
    element = document.createElement('div');
  });

  it('채널 값을 CSS 변수로 동기화', () => {
    composer.setBaseValue('tx', 10);
    composer.setBaseValue('ty', -5);
    composer.setBaseValue('sx', 1.2);
    composer.setBaseValue('rot', 45);
    composer.setBaseValue('opacity', 0.8);
    composer.setBaseValue('filter', 'blur(2px)');
    
    syncChannelsToDOM(composer, element);
    
    expect(element.style.getPropertyValue('--mtx-tx')).toBe('10px');
    expect(element.style.getPropertyValue('--mtx-ty')).toBe('-5px');
    expect(element.style.getPropertyValue('--mtx-sx')).toBe('1.2');
    expect(element.style.getPropertyValue('--mtx-rot')).toBe('45deg');
    expect(element.style.getPropertyValue('--mtx-opacity')).toBe('0.8');
    expect(element.style.getPropertyValue('--mtx-filter')).toBe('blur(2px)');
  });

  it('undefined/null 값은 건너뜀', () => {
    composer.setBaseValue('tx', 10);
    composer.compose('ty', undefined as any, 'replace');
    composer.compose('sx', null as any, 'replace');
    
    syncChannelsToDOM(composer, element);
    
    expect(element.style.getPropertyValue('--mtx-tx')).toBe('10px');
    // undefined/null 값은 CSS 변수로 설정되지 않음
    expect(element.style.getPropertyValue('--mtx-ty')).toBe('');
    expect(element.style.getPropertyValue('--mtx-sx')).toBe('');
  });

  it('커스텀 채널도 동기화됨', () => {
    composer.setBaseValue('customChannel', 'custom-value');
    
    syncChannelsToDOM(composer, element);
    
    expect(element.style.getPropertyValue('--mtx-customChannel')).toBe('custom-value');
  });
});