import type { IEventBus } from './event-bus.interface.js';
import type { PlatformEvent, EventHandler } from './event-bus.types.js';

/**
 * K5 Event Bus — In-process synchronous implementation.
 *
 * P0.8.3:
 * - Synchronous: publish() calls all handlers before returning.
 * - No persistence. Memory only.
 * - If a handler throws: log error, continue to next handler.
 *
 * OPT-5: Exact-match event subscriptions only (no pattern matching).
 * The interface accepts `pattern` for future Kafka/NATS compatibility,
 * but Phase 0 uses exact string match on event_type.
 */
export class EventBusService implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /** Publish event to all matching handlers synchronously */
  publish(event: PlatformEvent): void {
    const subscribers = this.handlers.get(event.event_type);
    if (!subscribers) return;

    for (const handler of subscribers) {
      try {
        const result = handler(event);
        // If handler returns a promise, we don't await it in Phase 0
        // but we catch rejections to prevent unhandled promise rejections
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            console.error(
              `[EventBus] Handler error for ${event.event_type}:`,
              err,
            );
          });
        }
      } catch (err) {
        console.error(
          `[EventBus] Handler error for ${event.event_type}:`,
          err,
        );
      }
    }
  }

  /** Subscribe to an exact event type. Returns unsubscribe function. */
  subscribe(pattern: string, handler: EventHandler): () => void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
    }
    const set = this.handlers.get(pattern)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(pattern);
      }
    };
  }

  /** Get subscriber count (for testing) */
  subscriberCount(pattern: string): number {
    return this.handlers.get(pattern)?.size ?? 0;
  }

  /** Clear all subscriptions (for testing) */
  clear(): void {
    this.handlers.clear();
  }
}

/** Singleton */
export const eventBus = new EventBusService();
