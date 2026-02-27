import type { PlatformEvent, EventHandler } from './event-bus.types.js';

/** K5 Event Bus — public contract */
export interface IEventBus {
  publish(event: PlatformEvent): void;
  subscribe(pattern: string, handler: EventHandler): () => void;
}
