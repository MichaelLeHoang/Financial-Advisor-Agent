import WorkspaceSubnav from "@/components/workspace/WorkspaceSubnav";
import { InvestmentWorkspaceProvider } from "@/components/investment-workspace/InvestmentWorkspaceProvider";

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return <div className="investment-workspace min-h-full"><WorkspaceSubnav workspace="invest"><InvestmentWorkspaceProvider>{children}</InvestmentWorkspaceProvider></WorkspaceSubnav></div>;
}
