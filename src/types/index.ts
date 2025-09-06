// Aggregate types entry re-export

export * from "./layout";
export * from "./plugin";
export * from "./timeline";
export * from "./scenario";

// Dev/demo convenience: align demo's RendererConfig to our Scenario schema
export type { ScenarioFileV1_3 as RendererConfig } from "./scenario";
