import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildLabSnapshot } from "../../src/lib/financial-model-lab.ts";

test("The Lab is a standalone public resource with a compatibility redirect", () => {
  const navigation = readFileSync(new URL("../../src/config/workspace-navigation.ts", import.meta.url), "utf8");
  const introduction = readFileSync(new URL("../../src/app/introduction/components.tsx", import.meta.url), "utf8");
  const appShell = readFileSync(new URL("../../src/app/AppShell.tsx", import.meta.url), "utf8");
  const redirectPage = readFileSync(new URL("../../src/app/discover/models/page.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../src/app/lab/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(navigation, /id: "lab"/);
  assert.match(introduction, /href="\/lab"/);
  assert.match(appShell, /"\/lab"/);
  assert.match(redirectPage, /permanentRedirect\("\/lab"\)/);
  assert.match(page, /getFinancialModelLabSnapshot/);
  assert.match(page, /IntroductionNav/);
  assert.match(page, /IntroductionFooter/);
  assert.match(page, /Models earn their way out of the lab/);
  assert.match(page, /No registered real-data packet/);
  assert.doesNotMatch(page, /api\.predict/);

  const adapter = readFileSync(new URL("../../src/lib/financial-model-lab.ts", import.meta.url), "utf8");
  assert.match(adapter, /process\.env\.GITHUB_LAB_TOKEN/);
  assert.match(adapter, /Authorization: `Bearer \$\{token\}`/);
});

test("lab snapshot derives registry counts and model families from the repository tree", () => {
  const snapshot = buildLabSnapshot(
    { default_branch: "main", html_url: "https://github.com/example/lab", updated_at: "2026-08-20T00:00:00Z" },
    { sha: "1234567890", html_url: "https://github.com/example/lab/commit/1234567", commit: { message: "feat: update lab\n\nDetails", committer: { date: "2026-08-19T00:00:00Z" } } },
    {
      tree: [
        { path: "configs/models/tuned_rf_lstm_v1.yaml", type: "blob" },
        { path: "configs/models/untuned_rf_lstm_v1.yaml", type: "blob" },
        { path: "configs/models/xgboost_core_v1.yaml", type: "blob" },
        { path: "configs/models/new_candidate_v2.yaml", type: "blob" },
        { path: "docs/contracts/evaluation-packet-v1.md", type: "blob" },
        { path: "experiments/charters/btc.md", type: "blob" },
        { path: "tests/test_evaluation.py", type: "blob" },
      ],
    },
  );

  assert.equal(snapshot.modelConfigCount, 4);
  assert.equal(snapshot.modelFamilies.length, 3);
  assert.equal(snapshot.modelFamilies[0]?.configPaths.length, 2);
  assert.equal(snapshot.modelFamilies[2]?.stage, "New entry");
  assert.equal(snapshot.contractCount, 1);
  assert.equal(snapshot.charterCount, 1);
  assert.equal(snapshot.testCount, 1);
  assert.equal(snapshot.goldIdentityCount, 0);
  assert.equal(snapshot.evaluationPacketCount, 0);
  assert.equal(snapshot.promotionManifestCount, 0);
  assert.equal(snapshot.latestCommit.sha, "1234567");
  assert.equal(snapshot.latestCommit.message, "feat: update lab");
});
