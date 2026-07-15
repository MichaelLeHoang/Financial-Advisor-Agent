export type PaperOrder = { id: string; symbol: string; side: "buy" | "sell"; quantity: number; orderType: "market" | "limit" | "stop"; timeInForce: "day" | "gtc"; entry: number; stop: number; target: number; maximumLoss: number; thesis?: string; status: "reviewed" | "filled"; submittedAt: string };
export type SubmitPaperOrderInput = Omit<PaperOrder, "id" | "status" | "submittedAt">;
export interface PaperTradingService { listOrders(): Promise<PaperOrder[]>; submitOrder(input: SubmitPaperOrderInput): Promise<PaperOrder>; }
export class SessionPaperTradingService implements PaperTradingService {
  constructor(private readonly storageKey = "quanfora.paper-orders.guest") {}
  async listOrders() { if (typeof window === "undefined") return []; try { return JSON.parse(window.sessionStorage.getItem(this.storageKey) ?? "[]") as PaperOrder[]; } catch { return []; } }
  async submitOrder(input: SubmitPaperOrderInput) { const order: PaperOrder = { ...input, id: `paper-${Date.now()}`, status: "filled", submittedAt: new Date().toISOString() }; const orders = [...await this.listOrders(), order]; try { window.sessionStorage.setItem(this.storageKey, JSON.stringify(orders)); } catch {} return order; }
}
