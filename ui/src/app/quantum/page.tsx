"use client";

import { useState } from "react";
import { Atom, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { OptimizeResult } from "@/lib/api";

const COLORS = ["#6366f1","#22d3ee","#34d399","#fbbf24","#f87171"];

export default function QuantumPage() {
  const [input, setInput] = useState("");
  const [tickers, setTickers] = useState<string[]>(["AAPL","NVDA","GOOGL","TSLA","AMZN"]);
  const [targetAssets, setTargetAssets] = useState(3);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const add = () => {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t)) setTickers(p => [...p, t]);
    setInput("");
  };

  const run = async () => {
    setLoading(true);
    try { setResult(await api.optimize(tickers, "quantum", 1.0, targetAssets)); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Atom className="w-6 h-6" style={{ color: "var(--accent-cyan)" }} />
        <h1 className="text-2xl font-bold glow-text">Quantum QAOA Optimizer</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Uses a quantum-inspired QAOA circuit (PennyLane) to select the optimal stock subset.
      </p>

      {/* Circuit diagram: qubit wires */}
      <div className="glass rounded-2xl p-4 mb-4 overflow-x-auto">
        <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>QAOA CIRCUIT SCHEMATIC</p>
        <svg width={Math.max(260, tickers.length * 80)} height={tickers.length * 36 + 20}>
          {tickers.map((t, i) => (
            <g key={t}>
              {/* Wire */}
              <line x1={40} y1={18 + i * 36} x2={tickers.length * 80 + 20} y2={18 + i * 36}
                stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
              {/* Label */}
              <text x={4} y={23 + i * 36} fontSize={10} fill="var(--text-secondary)">{t}</text>
              {/* Hadamard gate */}
              <rect x={48} y={8 + i * 36} width={20} height={20} rx={3} fill="#6366f1" opacity={0.8} />
              <text x={58} y={22 + i * 36} fontSize={9} fill="white" textAnchor="middle">H</text>
              {/* Layer gates */}
              {[1, 2].map((layer) => (
                <g key={layer}>
                  <rect x={90 + layer * 60} y={8 + i * 36} width={20} height={20} rx={3} fill="#22d3ee" opacity={0.7} />
                  <text x={100 + layer * 60} y={22 + i * 36} fontSize={7} fill="white" textAnchor="middle">Rz</text>
                </g>
              ))}
              {/* Measurement */}
              <circle cx={tickers.length * 80 + 10} cy={18 + i * 36} r={7} fill="rgba(251,191,36,0.3)" stroke="#fbbf24" strokeWidth={1} />
              <text x={tickers.length * 80 + 10} y={22 + i * 36} fontSize={8} fill="#fbbf24" textAnchor="middle">M</text>
            </g>
          ))}
        </svg>
        <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: "#6366f1" }} />Hadamard</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: "#22d3ee" }} />QAOA Layers</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: "#fbbf24", opacity: 0.5 }} />Measure</span>
        </div>
      </div>

      {/* Tickers + config */}
      <div className="glass rounded-2xl p-4 mb-4">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>STOCK UNIVERSE ({tickers.length} qubits)</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {tickers.map((t) => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
              style={{ background: "var(--accent)", color: "white" }}>
              {t}
              <button onClick={() => setTickers(p => p.filter(x => x !== t))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 glass rounded-xl px-3 py-2 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Add ticker…" value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} className="glass px-3 rounded-xl" style={{ color: "var(--accent)" }}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3">
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            SELECT {targetAssets} of {tickers.length} stocks
          </p>
          <input type="range" min={1} max={Math.max(1, tickers.length - 1)} value={targetAssets}
            onChange={e => setTargetAssets(parseInt(e.target.value))}
            className="w-full accent-indigo-500" />
        </div>
      </div>

      <button onClick={run} disabled={loading || tickers.length < 2}
        className="w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #6366f1, #22d3ee)", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}>
        {loading ? "Running QAOA…" : "⚛️ Run Quantum Optimization"}
      </button>

      {/* Results */}
      {result?.top_states && (
        <div className="mt-6 glass rounded-2xl p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Selected Portfolio</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {result.selected_stocks?.map(t => (
                <span key={t} className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ background: "var(--accent-cyan)", color: "#07080b" }}>{t}</span>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Probability: {((result.best_probability ?? 0) * 100).toFixed(1)}%
            </p>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>TOP 5 QUANTUM STATES</p>
            {result.top_states.map((s, i) => (
              <div key={i} className="flex items-center gap-3 mb-2">
                <code className="text-xs w-28 shrink-0" style={{ color: "var(--text-muted)" }}>
                  |{s.bitstring}⟩
                </code>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${s.probability * 100}%`, background: COLORS[i] }} />
                </div>
                <span className="text-xs w-12 text-right" style={{ color: "var(--text-secondary)" }}>
                  {(s.probability * 100).toFixed(1)}%
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  [{s.stocks.join(", ")}]
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
