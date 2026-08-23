import type { ReactNode } from "react";

export type LabFigureKind = "rf-lstm" | "xgboost" | "tcn" | "patchtst" | "chronos-zero-shot" | "chronos-lora" | "generic";

const GRID_LINES = [72, 132, 192, 252, 312];

export function ForecastContractFigure() {
  const bars = Array.from({ length: 32 }, (_, index) => {
    const wave = Math.sin(index * 0.72) * 34 + Math.cos(index * 0.29) * 22;
    const center = 214 - index * 1.8 + wave;
    const body = 9 + (index % 4) * 3;
    return { x: 42 + index * 14, center, body };
  });

  return (
    <FigureFrame label="Forecast contract diagram · schematic, not market data">
      <svg viewBox="0 0 640 360" className="h-auto w-full" role="img" aria-labelledby="forecast-contract-title forecast-contract-desc">
        <title id="forecast-contract-title">The lab&apos;s one-hour endpoint forecast contract</title>
        <desc id="forecast-contract-desc">Ninety-six completed fifteen-minute bars feed a model that estimates one endpoint four bars later. The connecting line is an endpoint guide, not a forecast price path.</desc>
        {GRID_LINES.map((y) => <line key={y} x1="28" y1={y} x2="612" y2={y} stroke="rgba(255,255,255,.07)" />)}
        <line x1="486" y1="38" x2="486" y2="326" stroke="rgba(255,255,255,.16)" strokeDasharray="5 7" />
        {bars.map((bar, index) => (
          <g key={bar.x} opacity={0.52 + index / 72}>
            <line x1={bar.x} y1={bar.center - 15} x2={bar.x} y2={bar.center + 17} stroke={index % 3 === 0 ? "#67e8f9" : "#a5b4fc"} strokeWidth="1.4" />
            <rect x={bar.x - 3.5} y={bar.center - bar.body / 2} width="7" height={bar.body} rx="1.5" fill={index % 3 === 0 ? "#22d3ee" : "#818cf8"} />
          </g>
        ))}
        <path d="M476 162 C520 160 543 126 586 110" fill="none" stroke="#f8fafc" strokeWidth="2" strokeDasharray="6 7" />
        <circle cx="586" cy="110" r="7" fill="#07080b" stroke="#f8fafc" strokeWidth="2.5" />
        <path d="M586 82 V138" stroke="rgba(165,180,252,.55)" strokeWidth="10" strokeLinecap="round" />
        <circle cx="586" cy="110" r="4" fill="#f8fafc" />
        <text x="38" y="43" fill="rgba(255,255,255,.55)" fontSize="12">96 completed bars · 24 hours of context</text>
        <text x="501" y="43" fill="rgba(255,255,255,.55)" fontSize="12">4 bars · 1 hour</text>
        <text x="503" y="300" fill="rgba(255,255,255,.72)" fontSize="12">one scalar endpoint</text>
        <text x="503" y="317" fill="rgba(255,255,255,.36)" fontSize="10">no predicted candle path</text>
      </svg>
    </FigureFrame>
  );
}

export function ModelArchitectureFigure({ kind }: { kind: LabFigureKind }) {
  return (
    <FigureFrame label="Registered architecture · configuration diagram">
      <svg viewBox="0 0 620 330" className="h-auto w-full" role="img" aria-label={`${kind} registered model architecture diagram`}>
        <g strokeLinecap="round" strokeLinejoin="round">
          <Architecture kind={kind} />
        </g>
      </svg>
    </FigureFrame>
  );
}

function Architecture({ kind }: { kind: LabFigureKind }) {
  if (kind === "rf-lstm") {
    return (
      <>
        <FigureLabel x={34} y={36}>TABULAR BRANCH</FigureLabel>
        {[74, 126, 178].map((y, index) => (
          <g key={y}>
            <line x1="82" y1={y} x2="140" y2={y - 20 + index * 20} stroke="rgba(103,232,249,.62)" />
            <line x1="82" y1={y} x2="140" y2={y + 20 - index * 10} stroke="rgba(103,232,249,.32)" />
            <circle cx="82" cy={y} r="8" fill="#07151c" stroke="#67e8f9" />
            <circle cx="140" cy={y - 20 + index * 20} r="6" fill="#07151c" stroke="#67e8f9" />
          </g>
        ))}
        <rect x="52" y="226" width="122" height="38" rx="8" fill="rgba(34,211,238,.08)" stroke="rgba(103,232,249,.28)" />
        <text x="113" y="250" textAnchor="middle" fill="rgba(255,255,255,.72)" fontSize="12">5 finite RF trials</text>
        <FigureLabel x={244} y={36}>SEQUENCE BRANCH</FigureLabel>
        {[0, 1, 2, 3].map((index) => (
          <g key={index}>
            <rect x={245 + index * 58} y="101" width="40" height="58" rx="9" fill="rgba(129,140,248,.09)" stroke="rgba(165,180,252,.5)" />
            {index < 3 && <path d={`M${285 + index * 58} 130 H${303 + index * 58}`} stroke="rgba(165,180,252,.7)" />}
          </g>
        ))}
        <path d="M265 101 C265 73 401 73 401 101" fill="none" stroke="rgba(165,180,252,.3)" strokeDasharray="5 6" />
        <rect x="274" y="226" width="176" height="38" rx="8" fill="rgba(129,140,248,.08)" stroke="rgba(165,180,252,.28)" />
        <text x="362" y="250" textAnchor="middle" fill="rgba(255,255,255,.72)" fontSize="12">4 LSTM trials · 3 seeds</text>
        <path d="M174 150 C206 150 210 190 240 190 H470" fill="none" stroke="rgba(255,255,255,.24)" />
        <path d="M421 159 C444 159 446 190 470 190" fill="none" stroke="rgba(255,255,255,.24)" />
        <Endpoint x={535} y={190} />
      </>
    );
  }

  if (kind === "xgboost") {
    return (
      <>
        <FigureLabel x={34} y={36}>SEQUENTIAL TREE ENSEMBLE</FigureLabel>
        {[0, 1, 2].map((tree) => {
          const offset = 50 + tree * 150;
          return (
            <g key={tree}>
              <circle cx={offset + 50} cy="92" r="8" fill="#10160d" stroke="#bef264" />
              <path d={`M${offset + 50} 100 L${offset + 22} 142 M${offset + 50} 100 L${offset + 78} 142`} stroke="rgba(190,242,100,.52)" />
              <circle cx={offset + 22} cy="150" r="6" fill="#10160d" stroke="#bef264" />
              <circle cx={offset + 78} cy="150" r="6" fill="#10160d" stroke="#bef264" />
              <path d={`M${offset + 22} 156 L${offset + 5} 184 M${offset + 22} 156 L${offset + 38} 184 M${offset + 78} 156 L${offset + 62} 184 M${offset + 78} 156 L${offset + 95} 184`} stroke="rgba(190,242,100,.3)" />
              <text x={offset + 50} y="224" textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize="10">TREE {tree + 1}</text>
            </g>
          );
        })}
        <path d="M155 244 H495" stroke="rgba(255,255,255,.2)" />
        <circle cx="518" cy="244" r="22" fill="rgba(190,242,100,.1)" stroke="rgba(190,242,100,.55)" />
        <text x="518" y="250" textAnchor="middle" fill="#d9f99d" fontSize="20">Σ</text>
        <Endpoint x={574} y={244} />
        <text x="48" y="286" fill="rgba(255,255,255,.58)" fontSize="12">300 trees · depth 6 · learning rate 0.05</text>
      </>
    );
  }

  if (kind === "tcn") {
    return (
      <>
        <FigureLabel x={34} y={36}>CAUSAL DILATED CONVOLUTIONS</FigureLabel>
        {Array.from({ length: 12 }, (_, index) => <rect key={index} x={45 + index * 35} y="232" width="20" height="22" rx="4" fill={index === 11 ? "#67e8f9" : "rgba(103,232,249,.14)"} stroke="rgba(103,232,249,.34)" />)}
        {[1, 2, 4, 8, 16].map((dilation, layer) => {
          const y = 202 - layer * 34;
          const width = 35 * Math.min(dilation, 8);
          return (
            <g key={dilation}>
              <path d={`M${435 - width} ${y + 18} Q435 ${y - 22} 435 ${y + 18}`} fill="none" stroke={`rgba(165,180,252,${0.34 + layer * 0.1})`} strokeWidth="2" />
              <text x="463" y={y + 22} fill="rgba(255,255,255,.42)" fontSize="11">d={dilation}</text>
            </g>
          );
        })}
        <path d="M455 106 H526" stroke="rgba(255,255,255,.24)" />
        <Endpoint x={568} y={106} />
        <text x="46" y="288" fill="rgba(255,255,255,.58)" fontSize="12">5 residual blocks · 125-bar receptive field</text>
      </>
    );
  }

  if (kind === "patchtst") {
    return (
      <>
        <FigureLabel x={34} y={36}>PATCHED CHANNEL-INDEPENDENT ENCODER</FigureLabel>
        {Array.from({ length: 11 }, (_, index) => (
          <rect key={index} x={38 + index * 35} y={76 + (index % 2) * 13} width="48" height="64" rx="5" fill={`rgba(${index % 2 ? "34,211,238" : "129,140,248"},.1)`} stroke={`rgba(${index % 2 ? "103,232,249" : "165,180,252"},.38)`} />
        ))}
        <path d="M86 164 H467" stroke="rgba(255,255,255,.22)" />
        <rect x="184" y="188" width="236" height="56" rx="10" fill="rgba(129,140,248,.08)" stroke="rgba(165,180,252,.38)" />
        <text x="302" y="211" textAnchor="middle" fill="rgba(255,255,255,.72)" fontSize="12">shared Transformer encoder</text>
        <text x="302" y="229" textAnchor="middle" fill="rgba(255,255,255,.38)" fontSize="10">2 layers · 4 heads · dimension 64</text>
        <path d="M420 216 H514" stroke="rgba(255,255,255,.24)" />
        <Endpoint x={562} y={216} />
        <text x="40" y="286" fill="rgba(255,255,255,.58)" fontSize="12">11 overlapping patches per feature channel</text>
      </>
    );
  }

  if (kind === "chronos-zero-shot") {
    return (
      <>
        <FigureLabel x={34} y={36}>PINNED FOUNDATION MODEL · ZERO-SHOT</FigureLabel>
        {Array.from({ length: 16 }, (_, index) => <rect key={index} x={38 + index * 19} y="82" width="11" height={34 + (index % 5) * 9} rx="3" fill="rgba(103,232,249,.18)" stroke="rgba(103,232,249,.35)" />)}
        <path d="M356 120 H398" stroke="rgba(255,255,255,.25)" />
        <rect x="400" y="72" width="128" height="96" rx="12" fill="rgba(129,140,248,.1)" stroke="rgba(165,180,252,.44)" />
        <text x="464" y="112" textAnchor="middle" fill="rgba(255,255,255,.78)" fontSize="14">Chronos-2</text>
        <text x="464" y="135" textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="10">120M parameters</text>
        {[0.1, 0.5, 0.9].map((quantile, index) => (
          <g key={quantile}>
            <path d={`M528 120 H${560 + index * 13}`} stroke="rgba(255,255,255,.2)" />
            <circle cx={571 + index * 10} cy={96 + index * 24} r={index === 1 ? 6 : 4} fill={index === 1 ? "#f8fafc" : "#818cf8"} />
          </g>
        ))}
        <rect x="38" y="222" width="490" height="46" rx="8" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
        <text x="56" y="241" fill="rgba(255,255,255,.68)" fontSize="11">Immutable checkpoint revision</text>
        <text x="56" y="257" fill="rgba(255,255,255,.34)" fontSize="9">29ec3766… · 477,930,472-byte weights · SHA-256 verified</text>
      </>
    );
  }

  if (kind === "chronos-lora") {
    return (
      <>
        <FigureLabel x={34} y={36}>FROZEN BASE + TRAINABLE ADAPTERS</FigureLabel>
        <rect x="64" y="72" width="362" height="166" rx="14" fill="rgba(129,140,248,.07)" stroke="rgba(165,180,252,.32)" />
        <text x="245" y="143" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="16">Chronos-2 base</text>
        <text x="245" y="166" textAnchor="middle" fill="rgba(255,255,255,.34)" fontSize="11">weights remain frozen</text>
        {[96, 132, 168, 204].map((y, index) => (
          <g key={y}>
            <rect x="402" y={y} width="86" height="19" rx="5" fill="rgba(103,232,249,.14)" stroke="rgba(103,232,249,.48)" />
            <text x="445" y={y + 13} textAnchor="middle" fill="rgba(207,250,254,.72)" fontSize="9">LoRA {index + 1}</text>
          </g>
        ))}
        <path d="M488 158 H530" stroke="rgba(255,255,255,.25)" />
        <Endpoint x={570} y={158} />
        <text x="66" y="278" fill="rgba(255,255,255,.58)" fontSize="12">rank 8 · alpha 16 · 500-step maximum · 3 seeds</text>
      </>
    );
  }

  return (
    <>
      <FigureLabel x={34} y={36}>VERSIONED MODEL CONFIGURATION</FigureLabel>
      <rect x="50" y="80" width="520" height="168" rx="14" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.14)" />
      {[112, 144, 176, 208].map((y, index) => <line key={y} x1="82" y1={y} x2={index === 3 ? "370" : "500"} y2={y} stroke="rgba(255,255,255,.18)" strokeWidth="8" strokeLinecap="round" />)}
      <Endpoint x={540} y={276} />
    </>
  );
}

export function WalkForwardFigure() {
  const folds = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"];
  return (
    <FigureFrame label="Walk-forward evaluation · registered split design">
      <div className="p-5 sm:p-8">
        <div className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
          <Legend swatch="bg-white/18" label="Expanding train" />
          <Legend swatch="bg-indigo-400/45" label="Inner validation" />
          <Legend swatch="bg-amber-300/60" label="100-bar embargo" />
          <Legend swatch="bg-cyan-300/80" label="Untouched test" />
        </div>
        <div className="space-y-3" role="img" aria-label="Six expanding monthly walk-forward folds, each separated by validation and embargo regions before the untouched test month">
          {folds.map((month, index) => (
            <div key={month} className="grid grid-cols-[34px_minmax(0,1fr)_42px] items-center gap-3">
              <span className="text-[10px] text-white/55">F{index + 1}</span>
              <div className="flex h-7 overflow-hidden rounded-md bg-white/[0.035]">
                <span className="h-full bg-white/18" style={{ width: `${32 + index * 7}%` }} />
                <span className="h-full w-[12%] bg-indigo-400/45" />
                <span className="h-full w-[3%] min-w-1 bg-amber-300/60" />
                <span className="h-full w-[13%] bg-cyan-300/80" />
              </div>
              <span className="text-right text-[10px] font-semibold text-cyan-100/70">{month}</span>
            </div>
          ))}
        </div>
        <p className="mt-7 max-w-3xl text-xs leading-5 text-white/55">Each test month is opened once. A past test fold may enter a later fold&apos;s history only after its evaluation has been finalized.</p>
      </div>
    </FigureFrame>
  );
}

function FigureFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090b12] shadow-[0_24px_70px_-44px_rgba(0,0,0,.9)]">
      <figcaption className="border-b border-white/[0.07] px-4 py-3 text-[10px] font-semibold text-white/55">{label}</figcaption>
      {children}
    </figure>
  );
}

function FigureLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <text x={x} y={y} fill="rgba(255,255,255,.38)" fontSize="10" fontWeight="600">{children}</text>;
}

function Endpoint({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x - 26} y1={y} x2={x - 8} y2={y} stroke="rgba(255,255,255,.28)" />
      <circle cx={x} cy={y} r="9" fill="#090b12" stroke="#f8fafc" strokeWidth="2" />
      <circle cx={x} cy={y} r="3" fill="#f8fafc" />
    </g>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`size-2 rounded-sm ${swatch}`} />{label}</span>;
}
