/* eslint-disable no-console */
// Simple shared logger utility with scoped instances and debug gating

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let globalDebugEnabled = false;

export function setGlobalDebug(enabled: boolean): void {
  globalDebugEnabled = enabled;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setEnabled: (enabled: boolean | null) => void;
  enable: () => void;
  disable: () => void;
}

export function createLogger(
  scope: string,
  enabled: boolean | null = null
): Logger {
  let localEnabled: boolean | null = enabled; // null means follow global

  const prefix = (level: LogLevel) =>
    `[${scope}]` + (level === 'debug' ? '' : ` ${level.toUpperCase()}`);
  const isEnabled = (level: LogLevel) => {
    if (level === 'warn' || level === 'error') return true; // always log warnings/errors
    const flag = localEnabled === null ? globalDebugEnabled : localEnabled;
    return !!flag;
  };

  return {
    debug: (...args: unknown[]) => {
      if (isEnabled('debug')) console.log(prefix('debug'), ...args);
    },
    info: (...args: unknown[]) => {
      if (isEnabled('info')) console.info(prefix('info'), ...args);
    },
    warn: (...args: unknown[]) => {
      if (isEnabled('warn')) console.warn(prefix('warn'), ...args);
    },
    error: (...args: unknown[]) => {
      if (isEnabled('error')) console.error(prefix('error'), ...args);
    },
    setEnabled: (enabledVal: boolean | null) => {
      localEnabled = enabledVal;
    },
    enable: () => {
      localEnabled = true;
    },
    disable: () => {
      localEnabled = false;
    },
  };
}
