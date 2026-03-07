export type SyncRecord = {
  entity: string;
  id: string;
  updatedAt: string;
  operation: "create" | "update" | "delete";
};

export interface SyncAdapter {
  push(records: SyncRecord[]): Promise<void>;
  pull(since: string | null): Promise<SyncRecord[]>;
}

export class NoopSyncAdapter implements SyncAdapter {
  async push(_records: SyncRecord[]) {
    return;
  }

  async pull(_since: string | null) {
    return [];
  }
}

export class SyncEngine {
  constructor(private readonly adapter: SyncAdapter = new NoopSyncAdapter()) {}

  private queue: SyncRecord[] = [];

  enqueue(record: SyncRecord) {
    this.queue.push(record);
  }

  async flush() {
    if (this.queue.length === 0) return;
    const snapshot = [...this.queue];
    await this.adapter.push(snapshot);
    this.queue = [];
  }
}

export const syncEngine = new SyncEngine();
