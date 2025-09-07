export interface RegisteredPlugin {
  name: string;
  version: string;
  module: any; // may include default + named exports (evalChannels)
  baseUrl: string; // manifest base URL
  manifest: any;
}

export class DevPluginRegistry {
  private map = new Map<string, RegisteredPlugin>();

  register(p: RegisteredPlugin) {
    this.map.set(p.name, p);
    this.map.set(`${p.name}@${p.version}`, p);
  }

  resolve(name: string): RegisteredPlugin | undefined {
    return this.map.get(name);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  entries(): RegisteredPlugin[] {
    return Array.from(new Set(this.map.values()));
  }
}

export const devRegistry = new DevPluginRegistry();
