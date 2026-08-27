export interface ReconciliationEvent {
  rail: 'promptpay_billpay' | 'promptpay_ewallet' | 'bank_transfer';
  transRef?: string;
  externalRef?: string;
  ref1?: string;
  amountSatang: number;
  occurredAt: number;
  raw?: unknown;
}

export interface ReconciliationResult {
  paymentId: string;
  orderId: string;
  status: 'verified' | 'already_verified' | 'no_match';
  transRef?: string;
}

export interface ReconciliationProvider {
  name: string;
  lookup(transRef: string): Promise<ReconciliationEvent | null>;
  matchByRef1(ref1: string): Promise<ReconciliationEvent | null>;
}

// FakeProvider for tests — D3 decision
export class FakeReconciliationProvider implements ReconciliationProvider {
  name = 'fake';
  private events = new Map<string, ReconciliationEvent>();

  seed(event: ReconciliationEvent): void {
    if (event.transRef) this.events.set(event.transRef, event);
    if (event.ref1) this.events.set(`ref1:${event.ref1}`, event);
  }

  async lookup(transRef: string): Promise<ReconciliationEvent | null> {
    return this.events.get(transRef) ?? null;
  }

  async matchByRef1(ref1: string): Promise<ReconciliationEvent | null> {
    return this.events.get(`ref1:${ref1}`) ?? null;
  }
}
