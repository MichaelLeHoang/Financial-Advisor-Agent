import type { Metadata } from "next";

import { PlatformOverviewPage } from "./PlatformOverviewPage";

export const metadata: Metadata = {
  title: "Multi-Agent Platform Overview | Quanfora",
  description:
    "See how Quanfora routes an investment question through five specialist agents, weighted consensus, risk controls, and a final auditable answer.",
};

export default function PlatformPage() {
  return <PlatformOverviewPage />;
}
