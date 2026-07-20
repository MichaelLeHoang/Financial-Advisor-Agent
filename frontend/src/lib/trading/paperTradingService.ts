import {
  api,
  type PaperAccount,
  type PaperAccountSnapshot,
  type PaperOrder,
  type PaperOrderRequest,
} from "@/lib/api";

export type { PaperAccount, PaperAccountSnapshot, PaperOrder, PaperOrderRequest };

export interface PaperTradingService {
  listAccounts(): Promise<PaperAccount[]>;
  snapshot(accountId: string): Promise<PaperAccountSnapshot>;
  submitOrder(accountId: string, input: PaperOrderRequest): Promise<PaperOrder>;
  cancelOrder(orderId: string): Promise<PaperOrder>;
  refresh(accountId: string): Promise<PaperAccountSnapshot>;
}

export class ApiPaperTradingService implements PaperTradingService {
  listAccounts() {
    return api.paperAccounts();
  }

  snapshot(accountId: string) {
    return api.paperAccountSnapshot(accountId);
  }

  submitOrder(accountId: string, input: PaperOrderRequest) {
    return api.submitPaperOrder(accountId, input);
  }

  cancelOrder(orderId: string) {
    return api.cancelPaperOrder(orderId);
  }

  refresh(accountId: string) {
    return api.refreshPaperAccount(accountId);
  }
}
