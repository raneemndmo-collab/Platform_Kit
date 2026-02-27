/** Platform event envelope — P0.8.1 */
export interface PlatformEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  tenant_id: string;
  actor_id: string;
  actor_type: 'user';
  object_id: string | null;
  object_type: string | null;
  action_id: string;
  payload: {
    before: unknown | null;
    after: unknown | null;
  };
  metadata: {
    ip_address: string | null;
    session_id: string | null;
    correlation_id: string;
    request_id: string;
  };
}

/** Event handler function */
export type EventHandler = (event: PlatformEvent) => void | Promise<void>;
