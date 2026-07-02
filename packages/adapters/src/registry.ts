import type { AgentAdapter, AgentId } from '@guardrails/shared';
import { BUILT_IN_ADAPTERS } from './adapters.js';

/**
 * A registry of agent adapters keyed by tool id. Third parties can register
 * their own adapters without a core change.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<AgentId, AgentAdapter>();

  register(adapter: AgentAdapter): this {
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  unregister(id: AgentId): boolean {
    return this.adapters.delete(id);
  }

  get(id: AgentId): AgentAdapter | undefined {
    return this.adapters.get(id);
  }

  has(id: AgentId): boolean {
    return this.adapters.has(id);
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }

  get size(): number {
    return this.adapters.size;
  }

  /** A registry preloaded with every built-in adapter. */
  static withDefaults(): AdapterRegistry {
    const registry = new AdapterRegistry();
    for (const adapter of BUILT_IN_ADAPTERS) registry.register(adapter);
    return registry;
  }
}
