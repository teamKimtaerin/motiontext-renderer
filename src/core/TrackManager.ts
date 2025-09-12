import type { Scenario, Track } from '../types/scenario-v2';

export interface GroupItem {
  el: HTMLElement;
  node: any;
}

export class TrackManager {
  private scenario: Scenario | null = null;

  setScenario(scenario: Scenario) {
    this.scenario = scenario;
  }

  computeGroupOffsets(
    items: GroupItem[],
    gapPx: number = 0
  ): Map<HTMLElement, number> {
    const map = new Map<HTMLElement, number>();
    let yOff = 0;

    for (const { el } of items) {
      if (el.style.display === 'none') continue;
      map.set(el, yOff);
      const h = el.offsetHeight || 0;
      yOff += h + gapPx;
    }

    return map;
  }

  getTrackDefaults(trackId: string): any | undefined {
    if (!this.scenario) return undefined;
    const track = this.scenario.tracks.find((t) => t.id === trackId);
    return track?.defaultStyle;
  }

  getTrackById(trackId: string): Track | undefined {
    if (!this.scenario) return undefined;
    return this.scenario.tracks.find((t) => t.id === trackId);
  }
}
