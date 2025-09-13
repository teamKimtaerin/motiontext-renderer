// CSS 변수 채널 시스템 (Plugin System v3.0)
// 플러그인 간 채널 합성 및 충돌 방지 시스템

import type { ChannelValues } from './DomSeparation';

export type ComposeMode = 'replace' | 'add' | 'multiply';

export interface ChannelSpec {
  name: string;
  value: any;
  mode: ComposeMode;
  priority?: number; // 높을수록 우선순위 (기본: 0)
}

export interface ChannelState {
  baseValue: any; // 렌더러가 설정한 기본값
  compositions: ChannelSpec[]; // 플러그인이 설정한 합성 값들
  finalValue: any; // 최종 계산된 값
}

/**
 * 채널별 합성 규칙 정의
 */
const CHANNEL_RULES: Record<
  string,
  {
    defaultValue: any;
    additive: boolean; // add 모드가 의미가 있는지
    multiplicative: boolean; // multiply 모드가 의미가 있는지
    unit?: string;
  }
> = {
  tx: { defaultValue: 0, additive: true, multiplicative: false, unit: 'px' },
  ty: { defaultValue: 0, additive: true, multiplicative: false, unit: 'px' },
  sx: { defaultValue: 1, additive: false, multiplicative: true },
  sy: { defaultValue: 1, additive: false, multiplicative: true },
  rot: { defaultValue: 0, additive: true, multiplicative: false, unit: 'deg' },
  opacity: { defaultValue: 1, additive: false, multiplicative: true },
  filter: { defaultValue: '', additive: true, multiplicative: false },
  // 커스텀 채널은 기본적으로 replace만 지원
};

export class ChannelComposer {
  private channels = new Map<string, ChannelState>();

  constructor() {
    // 표준 채널 초기화
    Object.keys(CHANNEL_RULES).forEach((channelName) => {
      this.initializeChannel(channelName);
    });
  }

  /**
   * 채널 초기화
   */
  private initializeChannel(name: string): void {
    const rule = CHANNEL_RULES[name] || {
      defaultValue: null,
      additive: false,
      multiplicative: false,
    };

    this.channels.set(name, {
      baseValue: rule.defaultValue,
      compositions: [],
      finalValue: rule.defaultValue,
    });
  }

  /**
   * 렌더러에서 기본 채널 값 설정
   */
  setBaseValue(channel: string, value: any): void {
    if (!this.channels.has(channel)) {
      this.initializeChannel(channel);
    }

    const state = this.channels.get(channel)!;
    state.baseValue = value;
    this.recompute(channel);
  }

  /**
   * 플러그인에서 채널 값 합성
   */
  compose(
    channel: string,
    value: any,
    mode: ComposeMode = 'replace',
    priority = 0
  ): void {
    if (!this.channels.has(channel)) {
      this.initializeChannel(channel);
    }

    const state = this.channels.get(channel)!;

    // 기존 동일 우선순위 항목 제거 (최신 것으로 교체)
    state.compositions = state.compositions.filter(
      (comp) => comp.priority !== priority
    );

    // 새 합성 추가
    state.compositions.push({ name: channel, value, mode, priority });

    // 우선순위별 정렬 (낮은 우선순위부터 적용)
    state.compositions.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.recompute(channel);
  }

  /**
   * 특정 우선순위의 합성 제거
   */
  removeComposition(channel: string, priority: number): void {
    const state = this.channels.get(channel);
    if (!state) return;

    state.compositions = state.compositions.filter(
      (comp) => comp.priority !== priority
    );
    this.recompute(channel);
  }

  /**
   * 채널 값 재계산
   */
  private recompute(channel: string): void {
    const state = this.channels.get(channel);
    if (!state) return;

    const rule = CHANNEL_RULES[channel];
    let result = state.baseValue;

    // 합성 규칙 적용
    for (const comp of state.compositions) {
      result = this.applyComposition(result, comp.value, comp.mode, rule);
    }

    state.finalValue = result;
  }

  /**
   * 개별 합성 규칙 적용
   */
  private applyComposition(
    base: any,
    value: any,
    mode: ComposeMode,
    rule?: (typeof CHANNEL_RULES)[string]
  ): any {
    switch (mode) {
      case 'replace':
        return value;

      case 'add':
        if (rule?.additive === false) {
          console.warn(
            `Channel does not support additive composition, using replace`
          );
          return value;
        }

        // 숫자형: 덧셈
        if (typeof base === 'number' && typeof value === 'number') {
          return base + value;
        }

        // 문자열: 공백으로 연결 (filter용)
        if (typeof base === 'string' && typeof value === 'string') {
          return base ? `${base} ${value}` : value;
        }

        return value;

      case 'multiply':
        if (rule?.multiplicative === false) {
          console.warn(
            `Channel does not support multiplicative composition, using replace`
          );
          return value;
        }

        // 숫자형: 곱셈
        if (typeof base === 'number' && typeof value === 'number') {
          return base * value;
        }

        return value;

      default:
        return value;
    }
  }

  /**
   * 모든 채널의 최종 값을 ChannelValues로 반환
   */
  getComposedChannels(): ChannelValues {
    const result: ChannelValues = {};

    this.channels.forEach((state, name) => {
      result[name] = state.finalValue;
    });

    return result;
  }

  /**
   * 특정 채널의 최종 값 반환
   */
  getFinalValue(channel: string): any {
    const state = this.channels.get(channel);
    return state?.finalValue ?? null;
  }

  /**
   * 채널 상태 초기화
   */
  reset(): void {
    this.channels.forEach((state) => {
      state.compositions = [];
      state.finalValue = state.baseValue;
    });
  }

  /**
   * 디버깅용: 채널 상태 출력
   */
  debugChannelState(channel: string): any {
    const state = this.channels.get(channel);
    if (!state) return null;

    return {
      channel,
      baseValue: state.baseValue,
      compositions: state.compositions.map((c) => ({
        value: c.value,
        mode: c.mode,
        priority: c.priority,
      })),
      finalValue: state.finalValue,
    };
  }

  /**
   * 사용 가능한 채널 목록 반환
   */
  getAvailableChannels(): string[] {
    return Array.from(this.channels.keys());
  }
}

/**
 * 채널 합성기와 DOM 분리 시스템 통합
 * ChannelComposer의 결과를 baseWrapper에 CSS 변수로 적용
 */
export function syncChannelsToDOM(
  composer: ChannelComposer,
  baseWrapper: HTMLElement
): void {
  const channels = composer.getComposedChannels();

  Object.entries(channels).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const cssVar = `--mtx-${key}`;
    let cssValue: string;

    // 채널 규칙에 따른 단위 적용
    const rule = CHANNEL_RULES[key];
    if (rule?.unit && typeof value === 'number') {
      cssValue = `${value}${rule.unit}`;
    } else {
      cssValue = String(value);
    }

    baseWrapper.style.setProperty(cssVar, cssValue);
  });
}

/**
 * 플러그인용 채널 인터페이스
 * 플러그인이 안전하게 채널을 조작할 수 있는 API
 */
export class PluginChannelInterface {
  constructor(
    private composer: ChannelComposer,
    private pluginId: string,
    private priorityOffset: number = 100 // 플러그인별 우선순위 오프셋
  ) {}

  /**
   * 채널 값 설정
   */
  set(channel: string, value: any, mode: ComposeMode = 'replace'): void {
    const priority =
      this.priorityOffset + this.getPriorityForPlugin(this.pluginId);
    this.composer.compose(channel, value, mode, priority);
  }

  /**
   * 채널 값 가져오기
   */
  get(channel: string): any {
    return this.composer.getFinalValue(channel);
  }

  /**
   * 사용 가능한 채널 목록
   */
  get available(): string[] {
    return this.composer.getAvailableChannels();
  }

  /**
   * 플러그인 정리 (모든 합성 제거)
   */
  cleanup(): void {
    const priority =
      this.priorityOffset + this.getPriorityForPlugin(this.pluginId);

    this.composer.getAvailableChannels().forEach((channel) => {
      this.composer.removeComposition(channel, priority);
    });
  }

  /**
   * 플러그인 ID를 기반으로 우선순위 계산
   * 문자열 해시를 사용하여 일관된 우선순위 부여
   */
  private getPriorityForPlugin(pluginId: string): number {
    let hash = 0;
    for (let i = 0; i < pluginId.length; i++) {
      hash = ((hash << 5) - hash + pluginId.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 1000; // 0-999 범위
  }
}
