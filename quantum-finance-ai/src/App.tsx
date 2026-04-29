import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  Brain, 
  PieChart, 
  Atom, 
  Send, 
  Plus, 
  X, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  Settings,
  Bell,
  User,
  Zap,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { cn } from './lib/utils';
import { chatWithAI } from './services/geminiService';

// --- Types ---
type Page = 'chat' | 'market' | 'sentiment' | 'optimizer' | 'quantum';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  status?: 'fetching' | 'done';
}

// --- Components ---

const SettingsModal = ({ isOpen, onClose, settings, setSettings }: { 
  isOpen: boolean, 
  onClose: () => void, 
  settings: any, 
  setSettings: (s: any) => void 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-space-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass w-full max-w-2xl rounded-[40px] p-10 relative z-10 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-primary to-cyan-secondary" />
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-white/40" />
          </button>
        </div>

        <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4">
          {/* AI Model */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white/40 uppercase tracking-widest">AI Intelligence</label>
            <div className="grid grid-cols-2 gap-4">
              {['Gemini 3 Flash', 'Gemini 3.1 Pro'].map(m => (
                <button 
                  key={m}
                  onClick={() => setSettings({ ...settings, model: m })}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-left",
                    settings.model === m ? "bg-indigo-primary/20 border-indigo-primary text-white" : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                  )}
                >
                  <div className="font-bold">{m}</div>
                  <div className="text-xs opacity-60">{m.includes('Pro') ? 'High reasoning' : 'Fast & efficient'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Visual Theme</label>
            <div className="flex gap-4">
              {[
                { name: 'Deep Space', primary: '#6366f1', secondary: '#22d3ee' },
                { name: 'Emerald', primary: '#10b981', secondary: '#34d399' },
                { name: 'Crimson', primary: '#ef4444', secondary: '#f87171' },
              ].map(t => (
                <button 
                  key={t.name}
                  onClick={() => setSettings({ ...settings, theme: t.name })}
                  className={cn(
                    "flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                    settings.theme === t.name ? "bg-white/10 border-white/30" : "bg-white/5 border-white/10 opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.secondary }} />
                  </div>
                  <span className="text-xs font-bold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Risk Profile */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Default Risk Profile</label>
            <select 
              value={settings.risk}
              onChange={(e) => setSettings({ ...settings, risk: e.target.value })}
              className="w-full glass bg-white/5 border-white/10 rounded-2xl p-4 focus:outline-none focus:border-indigo-primary/50"
            >
              <option value="conservative" className="bg-space-black">Conservative</option>
              <option value="moderate" className="bg-space-black">Moderate</option>
              <option value="aggressive" className="bg-space-black">Aggressive</option>
            </select>
          </div>

          {/* Quantum Backend */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Quantum Backend</label>
            <div className="space-y-2">
              {['IonQ Forte (11 Qubits)', 'Rigetti Aspen-M-3', 'IBM Eagle (127 Qubits)'].map(q => (
                <button 
                  key={q}
                  onClick={() => setSettings({ ...settings, quantum: q })}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all flex justify-between items-center",
                    settings.quantum === q ? "bg-cyan-secondary/20 border-cyan-secondary text-white" : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                  )}
                >
                  <span className="font-bold">{q}</span>
                  {settings.quantum === q && <CheckCircle2 className="w-5 h-5 text-cyan-secondary" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-indigo-primary py-4 rounded-2xl font-bold glow-indigo hover:scale-[1.02] transition-transform"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ activePage, setActivePage, onSettingsClick }: { 
  activePage: Page, 
  setActivePage: (p: Page) => void,
  onSettingsClick: () => void
}) => {
  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'AI Advisor' },
    { id: 'market', icon: TrendingUp, label: 'Market' },
    { id: 'sentiment', icon: Brain, label: 'Sentiment' },
    { id: 'optimizer', icon: PieChart, label: 'Portfolio' },
    { id: 'quantum', icon: Atom, label: 'Quantum' },
  ];

  return (
    <div className="w-20 h-screen flex flex-col items-center py-8 border-r border-white/10 bg-space-black/50 backdrop-blur-md z-50">
      <div className="mb-12">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-primary to-cyan-secondary flex items-center justify-center glow-indigo">
          <Zap className="text-white w-6 h-6" />
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id as Page)}
            className={cn(
              "p-3 rounded-xl transition-all duration-300 relative group",
              activePage === item.id 
                ? "bg-indigo-primary/20 text-indigo-primary shadow-indigo-glow" 
                : "text-white/40 hover:text-white/80 hover:bg-white/5"
            )}
          >
            <item.icon className="w-6 h-6" />
            {activePage === item.id && (
              <motion.div 
                layoutId="active-indicator"
                className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-primary rounded-r-full"
              />
            )}
            <div className="absolute left-full ml-4 px-2 py-1 bg-white/10 backdrop-blur-md rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-6">
        <button 
          onClick={onSettingsClick}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <Settings className="w-6 h-6" />
        </button>
        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden">
          <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      </div>
    </div>
  );
};

// --- Pages ---

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', content: "Hello! I'm your Quantum AI Financial Advisor. How can I help you optimize your wealth today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate tool call
    const fetchingMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: "📈 Fetching stock data...", status: 'fetching' };
    setMessages(prev => [...prev, fetchingMsg]);

    try {
      const response = await chatWithAI(messages.concat(userMsg).map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => prev.filter(m => m.status !== 'fetching').concat({
        id: Date.now().toString(),
        role: 'model',
        content: response || "I'm sorry, I couldn't process that request."
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = ["Should I buy NVDA?", "Analyze AAPL sentiment", "Optimize my portfolio", "Market outlook 2026"];

  return (
    <div className="flex-1 flex flex-col h-screen relative overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.length === 1 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold bg-gradient-to-r from-white via-indigo-primary to-cyan-secondary bg-clip-text text-transparent"
            >
              What would you like to know?
            </motion.h1>
            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
              {suggestions.map((s) => (
                <button 
                  key={s}
                  onClick={() => setInput(s)}
                  className="glass glass-hover px-6 py-3 rounded-full text-sm text-white/70 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {msg.status === 'fetching' ? (
              <div className="glass px-4 py-2 rounded-xl flex items-center gap-3 text-sm text-indigo-primary border-indigo-primary/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                {msg.content}
              </div>
            ) : (
              <div className={cn(
                "max-w-[70%] p-4 rounded-2xl",
                msg.role === 'user' 
                  ? "bg-indigo-primary text-white glow-indigo" 
                  : "glass text-white/90"
              )}>
                {msg.content}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="p-8 pt-0">
        <div className="max-w-4xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about markets, stocks, or your portfolio..."
            className="w-full glass bg-white/5 border-white/10 rounded-2xl py-4 pl-6 pr-16 focus:outline-none focus:border-indigo-primary/50 transition-all placeholder:text-white/20"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-primary rounded-xl text-white glow-indigo hover:scale-105 transition-transform disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MarketPage = () => {
  const stocks = [
    { ticker: 'AAPL', name: 'Apple Inc.', price: '189.42', change: '+1.23%', up: true, data: [40, 45, 42, 48, 46, 50, 55] },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: '875.28', change: '+4.56%', up: true, data: [30, 40, 35, 50, 60, 55, 70] },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', price: '152.31', change: '-0.87%', up: false, data: [50, 48, 49, 45, 46, 44, 42] },
    { ticker: 'MSFT', name: 'Microsoft', price: '412.55', change: '+0.45%', up: true, data: [40, 41, 40, 42, 41, 43, 44] },
    { ticker: 'TSLA', name: 'Tesla, Inc.', price: '175.22', change: '-2.31%', up: false, data: [60, 55, 58, 50, 45, 48, 40] },
    { ticker: 'AMZN', name: 'Amazon.com', price: '178.15', change: '+1.12%', up: true, data: [35, 38, 36, 40, 42, 41, 45] },
    { ticker: 'META', name: 'Meta Platforms', price: '485.30', change: '+0.98%', up: true, data: [45, 46, 48, 47, 50, 52, 55] },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">Market Overview</h1>
        <button className="glass glass-hover p-3 rounded-xl"><RefreshCw className="w-5 h-5 text-white/60" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {stocks.map((stock) => (
          <motion.div 
            key={stock.ticker}
            whileHover={{ y: -5 }}
            className="glass glass-hover p-6 rounded-3xl group"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{stock.ticker}</h3>
                <p className="text-white/40 text-sm">{stock.name}</p>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold",
                stock.up ? "bg-green-positive/20 text-green-positive" : "bg-red-negative/20 text-red-negative"
              )}>
                {stock.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stock.change}
              </div>
            </div>
            
            <div className="text-3xl font-bold mb-6">${stock.price}</div>
            
            <div className="h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stock.data.map((v, i) => ({ v, i }))}>
                  <defs>
                    <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={stock.up ? "#34d399" : "#f87171"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={stock.up ? "#34d399" : "#f87171"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="v" 
                    stroke={stock.up ? "#34d399" : "#f87171"} 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill={`url(#grad-${stock.ticker})`} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const SentimentPage = () => {
  const [headlines, setHeadlines] = useState([
    { text: "Apple beats earnings expectations", sentiment: "positive", score: 95 },
    { text: "Fed signals potential rate hike", sentiment: "negative", score: 72 },
    { text: "Tech sector sees massive growth", sentiment: "positive", score: 88 }
  ]);
  const [input, setInput] = useState('');

  const addHeadline = () => {
    if (!input.trim()) return;
    setHeadlines([{ text: input, sentiment: Math.random() > 0.5 ? 'positive' : 'negative', score: Math.floor(Math.random() * 40) + 60 }, ...headlines]);
    setInput('');
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Sentiment Analysis</h1>
          <p className="text-white/40">Analyze market sentiment from news headlines and social media.</p>
        </div>

        <div className="flex gap-4">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHeadline()}
            placeholder="Enter a financial headline..." 
            className="flex-1 glass rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-primary/50"
          />
          <button 
            onClick={addHeadline}
            className="bg-indigo-primary px-8 rounded-2xl font-bold glow-indigo hover:scale-105 transition-transform"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {headlines.map((h, i) => (
            <div key={i} className="glass px-4 py-2 rounded-full text-sm flex items-center gap-2">
              {h.text}
              <button onClick={() => setHeadlines(headlines.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-white/40 hover:text-white" /></button>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center py-12 glass rounded-[40px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-negative via-amber-warning to-green-positive" />
          
          <div className="relative w-64 h-32 mb-8">
            <svg viewBox="0 0 100 50" className="w-full h-full">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#ffffff10" strokeWidth="8" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#gauge-grad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="31.4" />
              <defs>
                <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <line x1="50" y1="50" x2="80" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" transform="rotate(45 50 50)" />
              <circle cx="50" cy="50" r="3" fill="white" />
            </svg>
          </div>

          <div className="text-center">
            <div className="text-green-positive text-5xl font-bold mb-2">BULLISH</div>
            <div className="text-white/40 text-sm">Sentiment Score: 84/100</div>
          </div>

          <div className="grid grid-cols-3 gap-12 mt-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-positive">12</div>
              <div className="text-xs text-white/40">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-negative">3</div>
              <div className="text-xs text-white/40">Negative</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-warning">5</div>
              <div className="text-xs text-white/40">Neutral</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {headlines.map((h, i) => (
            <div key={i} className="glass p-4 rounded-2xl flex justify-between items-center">
              <span className="text-white/80">{h.text}</span>
              <div className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold uppercase",
                h.sentiment === 'positive' ? "bg-green-positive/20 text-green-positive" : "bg-red-negative/20 text-red-negative"
              )}>
                {h.sentiment} {h.score}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const OptimizerPage = () => {
  const [tickers, setTickers] = useState(['AAPL', 'NVDA', 'GOOGL']);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'classical' | 'quantum'>('classical');

  const data = [
    { name: 'AAPL', value: 35, color: '#6366f1' },
    { name: 'NVDA', value: 25, color: '#22d3ee' },
    { name: 'GOOGL', value: 20, color: '#34d399' },
    { name: 'MSFT', value: 15, color: '#fbbf24' },
    { name: 'TSLA', value: 5, color: '#f87171' },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-10">
        <h1 className="text-4xl font-bold">Portfolio Optimizer</h1>

        <div className="glass p-8 rounded-[32px] space-y-8">
          <div className="space-y-4">
            <label className="text-sm text-white/40">Target Assets</label>
            <div className="flex flex-wrap gap-3 p-4 glass rounded-2xl">
              {tickers.map(t => (
                <div key={t} className="bg-indigo-primary/20 text-indigo-primary px-4 py-2 rounded-xl flex items-center gap-2 font-bold">
                  {t} <button onClick={() => setTickers(tickers.filter(x => x !== t))}><X className="w-4 h-4" /></button>
                </div>
              ))}
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && (setTickers([...tickers, input]), setInput(''))}
                placeholder="Add ticker..." 
                className="bg-transparent focus:outline-none text-sm w-24"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-sm text-white/40">Optimization Strategy</label>
              <div className="flex p-1 glass rounded-2xl">
                <button 
                  onClick={() => setMode('classical')}
                  className={cn("flex-1 py-3 rounded-xl transition-all", mode === 'classical' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Classical
                </button>
                <button 
                  onClick={() => setMode('quantum')}
                  className={cn("flex-1 py-3 rounded-xl transition-all", mode === 'quantum' ? "bg-indigo-primary text-white glow-indigo" : "text-white/40")}
                >
                  Quantum
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm text-white/40">Risk Tolerance</label>
              <div className="px-4 py-6">
                <input type="range" className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-primary" />
                <div className="flex justify-between mt-2 text-xs text-white/40">
                  <span>Conservative</span>
                  <span>Aggressive</span>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full bg-indigo-primary py-5 rounded-2xl font-bold text-lg glow-indigo hover:scale-[1.01] transition-transform">
            Optimize Portfolio
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Expected Return', value: '18.5%', color: 'text-green-positive' },
            { label: 'Volatility', value: '22.1%', color: 'text-amber-warning' },
            { label: 'Sharpe Ratio', value: '0.84', color: 'text-indigo-primary' },
          ].map(m => (
            <div key={m.label} className="glass p-6 rounded-3xl text-center">
              <div className="text-white/40 text-sm mb-2">{m.label}</div>
              <div className={cn("text-4xl font-bold", m.color)}>{m.value}</div>
            </div>
          ))}
        </div>

        <div className="glass p-10 rounded-[40px] flex flex-col md:flex-row items-center gap-12">
          <div className="w-64 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data}
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-6 w-full">
            {data.map(d => (
              <div key={d.name} className="flex items-center justify-between p-4 glass rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="font-bold">{d.name}</span>
                </div>
                <span className="text-white/60">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuantumPage = () => {
  const tickers = ['AAPL', 'NVDA', 'GOOGL', 'TSLA', 'AMZN'];
  
  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2">Quantum QAOA</h1>
            <p className="text-white/40">Quantum Approximate Optimization Algorithm for discrete asset selection.</p>
          </div>
          <div className="glass px-4 py-2 rounded-xl text-xs text-cyan-secondary border-cyan-secondary/30">
            Quantum Processor: IonQ Forte (11 Qubits)
          </div>
        </div>

        {/* Quantum Circuit Visualization */}
        <div className="glass p-10 rounded-[40px] overflow-x-auto">
          <div className="min-w-[800px] space-y-8">
            {tickers.map((t, i) => (
              <div key={t} className="flex items-center gap-6">
                <div className="w-16 font-mono text-sm text-white/40">{t}</div>
                <div className="flex-1 h-[2px] bg-white/10 relative flex items-center gap-12 px-12">
                  <div className="w-10 h-10 rounded bg-indigo-primary flex items-center justify-center text-xs font-bold glow-indigo">H</div>
                  <div className="w-10 h-10 rounded bg-cyan-secondary flex items-center justify-center text-xs font-bold glow-cyan">Rz</div>
                  <div className="w-10 h-10 rounded bg-indigo-primary flex items-center justify-center text-xs font-bold glow-indigo">H</div>
                  <div className="ml-auto w-8 h-8 rounded-full border-2 border-amber-warning flex items-center justify-center">
                    <div className="w-1 h-4 bg-amber-warning rotate-45" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass p-8 rounded-[32px] space-y-6">
            <h3 className="text-xl font-bold">Parameters</h3>
            <div className="space-y-4">
              <label className="text-sm text-white/40">Select 3 of 5 stocks</label>
              <input type="range" className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-secondary" />
            </div>
            <div className="flex flex-wrap gap-2">
              {tickers.map(t => (
                <div key={t} className="px-3 py-1 glass rounded-lg text-xs font-bold">{t}</div>
              ))}
            </div>
            <button className="w-full bg-gradient-to-r from-indigo-primary to-cyan-secondary py-4 rounded-2xl font-bold glow-indigo">
              Run Quantum Optimization
            </button>
          </div>

          <div className="glass p-8 rounded-[32px] space-y-6">
            <h3 className="text-xl font-bold">Top 5 Quantum States</h3>
            <div className="space-y-4">
              {[
                { state: '|10110⟩', prob: 42, color: '#6366f1' },
                { state: '|11010⟩', prob: 28, color: '#22d3ee' },
                { state: '|10011⟩', prob: 15, color: '#34d399' },
                { state: '|01110⟩', prob: 10, color: '#fbbf24' },
                { state: '|11100⟩', prob: 5, color: '#f87171' },
              ].map(s => (
                <div key={s.state} className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono">{s.state}</span>
                    <span className="text-white/40">{s.prob}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${s.prob}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activePage, setActivePage] = useState<Page>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    model: 'Gemini 3 Flash',
    theme: 'Deep Space',
    risk: 'moderate',
    quantum: 'IonQ Forte (11 Qubits)'
  });

  return (
    <div className="flex h-screen bg-space-black text-white overflow-hidden relative">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-primary/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-secondary/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-primary/5 rounded-full blur-[100px] animate-blob animation-delay-4000" />
      </div>

      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
      <main className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-space-black/30 backdrop-blur-md z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-primary" />
            </div>
            <span className="font-bold tracking-tight text-xl">Quantum Advisor</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-5 h-5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search markets..." 
                className="glass bg-white/5 border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-primary/50 w-64"
              />
            </div>
            <button className="relative text-white/40 hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-negative rounded-full border border-space-black" />
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold">Alex Rivera</div>
                <div className="text-[10px] text-indigo-primary font-bold uppercase tracking-widest">Premium Plan</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-primary/20 flex items-center justify-center border border-indigo-primary/30">
                <User className="w-5 h-5 text-indigo-primary" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {activePage === 'chat' && <ChatPage />}
            {activePage === 'market' && <MarketPage />}
            {activePage === 'sentiment' && <SentimentPage />}
            {activePage === 'optimizer' && <OptimizerPage />}
            {activePage === 'quantum' && <QuantumPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          settings={settings}
          setSettings={setSettings}
        />
      </AnimatePresence>
    </div>
  );
}
