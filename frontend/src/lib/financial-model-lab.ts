const LAB_OWNER = "MichaelLeHoang";
const LAB_REPOSITORY = "financial-model-lab";
const LAB_BRANCH = "main";

export const FINANCIAL_MODEL_LAB_URL = `https://github.com/${LAB_OWNER}/${LAB_REPOSITORY}`;

type GitHubRepository = {
  default_branch: string;
  html_url: string;
  updated_at: string;
};

type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    committer: { date: string };
  };
};

type GitHubTree = {
  tree: Array<{ path: string; type: "blob" | "tree" }>;
};

export type LabModelFamily = {
  id: string;
  name: string;
  stage: string;
  approach: string;
  evidence: string;
  configPaths: string[];
};

export type FinancialModelLabSnapshot = {
  repositoryUrl: string;
  branch: string;
  updatedAt: string;
  latestCommit: {
    sha: string;
    message: string;
    date: string;
    url: string;
  };
  modelConfigCount: number;
  contractCount: number;
  charterCount: number;
  testCount: number;
  goldIdentityCount: number;
  evaluationPacketCount: number;
  promotionManifestCount: number;
  modelFamilies: LabModelFamily[];
  annotationsAsOfSha: string;
  sourceStatus: "live" | "fallback";
};

const ANNOTATIONS_AS_OF_SHA = "38722f7";

const MODEL_FAMILY_RULES: Array<Omit<LabModelFamily, "configPaths"> & { matches: string[] }> = [
  {
    id: "rf-lstm",
    name: "Random Forest + LSTM",
    stage: "Stage 10",
    approach: "Reproduction and finite tuning",
    evidence: "Deterministic tree baseline and three-seed PyTorch sequence runs.",
    matches: ["untuned_rf_lstm_v1.yaml", "tuned_rf_lstm_v1.yaml"],
  },
  {
    id: "xgboost",
    name: "XGBoost",
    stage: "Stage 14",
    approach: "Boosted-tree extension",
    evidence: "Fold-local training with validation-only permutation importance.",
    matches: ["xgboost_core_v1.yaml"],
  },
  {
    id: "tcn",
    name: "Temporal Convolutional Network",
    stage: "Stage 14",
    approach: "Causal sequence extension",
    evidence: "Dilated windows, fold-only scaling, and three deterministic seeds.",
    matches: ["tcn_core_v1.yaml"],
  },
  {
    id: "patchtst",
    name: "PatchTST-style regressor",
    stage: "Stage 14",
    approach: "Patch-based transformer",
    evidence: "Shared encoder over causal 96-bar windows with validation stopping.",
    matches: ["patchtst_core_v1.yaml"],
  },
  {
    id: "chronos-zero-shot",
    name: "Chronos-2 zero-shot",
    stage: "Stage 14",
    approach: "Pinned foundation model",
    evidence: "Verified checkpoint snapshot with no task-specific fitting.",
    matches: ["chronos2_zero_shot_core_v1.yaml"],
  },
  {
    id: "chronos-lora",
    name: "Chronos-2 LoRA",
    stage: "Stage 14",
    approach: "Parameter-efficient fine-tuning",
    evidence: "Rank-8 adapters with fold-train supervision and validation selection.",
    matches: ["chronos2_lora_core_v1.yaml"],
  },
];

const FALLBACK_TREE: GitHubTree = {
  tree: [
    ...[
      "chronos2_lora_core_v1.yaml",
      "chronos2_zero_shot_core_v1.yaml",
      "patchtst_core_v1.yaml",
      "tcn_core_v1.yaml",
      "tuned_rf_lstm_v1.yaml",
      "untuned_rf_lstm_v1.yaml",
      "xgboost_core_v1.yaml",
    ].map((name) => ({ path: `configs/models/${name}`, type: "blob" as const })),
    ...Array.from({ length: 19 }, (_, index) => ({ path: `docs/contracts/contract-${index}.md`, type: "blob" as const })),
    { path: "experiments/charters/btc_spot_15m_1h_v1.md", type: "blob" },
    ...Array.from({ length: 16 }, (_, index) => ({ path: `tests/test_${index}.py`, type: "blob" as const })),
  ],
};

const FALLBACK_REPOSITORY: GitHubRepository = {
  default_branch: LAB_BRANCH,
  html_url: FINANCIAL_MODEL_LAB_URL,
  updated_at: "2026-08-20T03:39:32Z",
};

const FALLBACK_COMMIT: GitHubCommit = {
  sha: "38722f73a3e57ad9ce2437a56261416894f551a2",
  html_url: `${FINANCIAL_MODEL_LAB_URL}/commit/38722f73a3e57ad9ce2437a56261416894f551a2`,
  commit: {
    message: "feat(promotion): define Stage 15 shadow contracts",
    committer: { date: "2026-08-18T20:30:06Z" },
  },
};

function githubFileUrl(path: string, branch: string) {
  return `${FINANCIAL_MODEL_LAB_URL}/blob/${branch}/${path}`;
}

export function buildLabSnapshot(
  repository: GitHubRepository,
  commit: GitHubCommit,
  tree: GitHubTree,
  sourceStatus: FinancialModelLabSnapshot["sourceStatus"] = "live",
): FinancialModelLabSnapshot {
  const paths = tree.tree.filter((item) => item.type === "blob").map((item) => item.path);
  const modelConfigs = paths.filter((path) => path.startsWith("configs/models/") && path.endsWith(".yaml"));
  const modelFamilies = MODEL_FAMILY_RULES.flatMap(({ matches, ...family }) => {
    const configPaths = modelConfigs.filter((path) => matches.some((match) => path.endsWith(match)));
    return configPaths.length ? [{ ...family, configPaths }] : [];
  });
  const matchedConfigs = new Set(modelFamilies.flatMap((family) => family.configPaths));
  const unreviewedFamilies = modelConfigs
    .filter((path) => !matchedConfigs.has(path))
    .map((path) => ({
      id: path,
      name: humanizeConfigName(path),
      stage: "New entry",
      approach: "Repository configuration",
      evidence: "This configuration was discovered after the current display annotations were reviewed.",
      configPaths: [path],
    }));

  return {
    repositoryUrl: repository.html_url,
    branch: repository.default_branch,
    updatedAt: repository.updated_at,
    latestCommit: {
      sha: commit.sha.slice(0, 7),
      message: commit.commit.message.split("\n", 1)[0] || "Repository update",
      date: commit.commit.committer.date,
      url: commit.html_url,
    },
    modelConfigCount: modelConfigs.length,
    contractCount: paths.filter((path) => path.startsWith("docs/contracts/") && path.endsWith(".md")).length,
    charterCount: paths.filter((path) => path.startsWith("experiments/charters/") && path.endsWith(".md")).length,
    testCount: paths.filter((path) => path.startsWith("tests/test_") && path.endsWith(".py")).length,
    goldIdentityCount: paths.filter((path) => path.startsWith("experiments/identities/") && path.endsWith(".json")).length,
    evaluationPacketCount: paths.filter((path) => path.startsWith("evaluation/") && path.endsWith(".json")).length,
    promotionManifestCount: paths.filter((path) => path.includes("promotion") && path.includes("manifest") && path.endsWith(".json")).length,
    modelFamilies: [...modelFamilies, ...unreviewedFamilies].map((family) => ({
      ...family,
      configPaths: family.configPaths.map((path) => githubFileUrl(path, repository.default_branch)),
    })),
    annotationsAsOfSha: ANNOTATIONS_AS_OF_SHA,
    sourceStatus,
  };
}

function humanizeConfigName(path: string) {
  const filename = path.split("/").pop()?.replace(/\.ya?ml$/i, "") ?? "Model configuration";
  return filename.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function githubJson<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_LAB_TOKEN;
  const suffix = path ? `/${path}` : "";
  const response = await fetch(`https://api.github.com/repos/${LAB_OWNER}/${LAB_REPOSITORY}${suffix}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getFinancialModelLabSnapshot(): Promise<FinancialModelLabSnapshot> {
  try {
    const [repository, commit, tree] = await Promise.all([
      githubJson<GitHubRepository>(""),
      githubJson<GitHubCommit>(`commits/${LAB_BRANCH}`),
      githubJson<GitHubTree>(`git/trees/${LAB_BRANCH}?recursive=1`),
    ]);
    return buildLabSnapshot(repository, commit, tree);
  } catch {
    return buildLabSnapshot(FALLBACK_REPOSITORY, FALLBACK_COMMIT, FALLBACK_TREE, "fallback");
  }
}
