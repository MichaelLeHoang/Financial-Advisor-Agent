import { Suspense } from "react";
import EarningsWorkspace from "@/components/earnings/EarningsWorkspace";
import { InvestmentWorkspaceProvider } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import EarningsPageLoading from "./loading";

export default function EarningsPage() {
  return (
    <InvestmentWorkspaceProvider>
      <Suspense fallback={<EarningsPageLoading />}>
        <EarningsWorkspace />
      </Suspense>
    </InvestmentWorkspaceProvider>
  );
}
