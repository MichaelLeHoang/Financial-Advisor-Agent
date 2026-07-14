import WorkspaceSubnav from "@/components/workspace/WorkspaceSubnav";
import PortfolioBookSwitch from "@/components/portfolio/PortfolioBookSwitch";

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSubnav workspace="portfolio">
      <PortfolioBookSwitch />
      {children}
    </WorkspaceSubnav>
  );
}
