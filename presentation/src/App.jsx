import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart3, Cpu, Zap, DollarSign, Server, ShieldCheck, FileJson } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
  AreaChart, Area
} from 'recharts';

const Presentation = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Data Arrays for the Charts
  const geminiData = [
    { scenario: '200 req/day', 'Gemini 2.5 Flash': 22.32, 'Gemini 3 Flash': 30.25, 'Gemini 3 Pro': 121.00 },
    { scenario: '1k req/day', 'Gemini 2.5 Flash': 111.62, 'Gemini 3 Flash': 151.25, 'Gemini 3 Pro': 605.01 },
    { scenario: '5k req/day', 'Gemini 2.5 Flash': 558.11, 'Gemini 3 Flash': 756.27, 'Gemini 3 Pro': 3025.07 },
  ];

  const openaiData = [
    { scenario: '200 req/day', 'GPT-4o Mini': 7.29, 'GPT-5.4 Mini': 45.38, 'GPT-5.4': 151.27 },
    { scenario: '1k req/day', 'GPT-4o Mini': 36.44, 'GPT-5.4 Mini': 226.91, 'GPT-5.4': 756.38 },
    { scenario: '5k req/day', 'GPT-4o Mini': 182.18, 'GPT-5.4 Mini': 1134.56, 'GPT-5.4': 3781.88 },
  ];

  const anthropicData = [
    { scenario: '200 req/day', 'Haiku 4.5': 54.55, 'Sonnet 4.6': 163.64, 'Opus 4.7': 272.73 },
    { scenario: '1k req/day', 'Haiku 4.5': 272.73, 'Sonnet 4.6': 818.19, 'Opus 4.7': 1363.65 },
    { scenario: '5k req/day', 'Haiku 4.5': 1363.65, 'Sonnet 4.6': 4090.95, 'Opus 4.7': 6818.25 },
  ];

  // Colors for charts
  const colors = {
    budget: "#10b981", // Emerald
    mid: "#3b82f6",    // Blue
    flagship: "#8b5cf6" // Purple
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-xl text-slate-200">
          <p className="font-bold text-lg mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="font-medium">
              {entry.name}: ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /mo
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const slides = [
    {
      id: "title",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
          <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
            <Cpu size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight">NetoMate AI Architecture</h1>
          <h2 className="text-2xl text-slate-300 max-w-3xl font-light">Cost Analysis & Optimal LLM Selection for Telecom Test Flow Orchestration</h2>
          <div className="mt-12 inline-flex items-center space-x-2 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
            <Server size={16} className="text-blue-400" />
            <span className="text-sm text-slate-300">Baseline Context: 4,121 In | 994 Out</span>
          </div>
        </div>
      )
    },
    {
      id: "gemini",
      title: "Google Gemini Models",
      subtitle: "Monthly 30-Day Projections (USD)",
      content: (
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-emerald-400 font-semibold text-lg">2.5 Flash (Budget)</h3>
              <p className="text-slate-400 text-sm mb-2">$0.30 In / $2.50 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$22.32</span></p>
                <p>1k/day: <span className="float-right">$111.62</span></p>
                <p>5k/day: <span className="float-right">$558.11</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-blue-400 font-semibold text-lg">3 Flash (Mid)</h3>
              <p className="text-slate-400 text-sm mb-2">$0.50 In / $3.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$30.25</span></p>
                <p>1k/day: <span className="float-right">$151.25</span></p>
                <p>5k/day: <span className="float-right">$756.27</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-purple-400 font-semibold text-lg">3 Pro (Flagship)</h3>
              <p className="text-slate-400 text-sm mb-2">$2.00 In / $12.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$121.00</span></p>
                <p>1k/day: <span className="float-right">$605.01</span></p>
                <p>5k/day: <span className="float-right">$3,025.07</span></p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geminiData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="scenario" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Gemini 2.5 Flash" fill={colors.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gemini 3 Flash" fill={colors.mid} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gemini 3 Pro" fill={colors.flagship} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    },
    {
      id: "openai",
      title: "OpenAI Models",
      subtitle: "Monthly 30-Day Projections (USD)",
      content: (
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">LOWEST COST</div>
              <h3 className="text-emerald-400 font-semibold text-lg">GPT-4o Mini (Budget)</h3>
              <p className="text-slate-400 text-sm mb-2">$0.15 In / $0.60 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$7.29</span></p>
                <p>1k/day: <span className="float-right">$36.44</span></p>
                <p>5k/day: <span className="float-right text-emerald-400 font-bold">$182.18</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-blue-400 font-semibold text-lg">GPT-5.4 Mini (Mid)</h3>
              <p className="text-slate-400 text-sm mb-2">$0.75 In / $4.50 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$45.38</span></p>
                <p>1k/day: <span className="float-right">$226.91</span></p>
                <p>5k/day: <span className="float-right">$1,134.56</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-purple-400 font-semibold text-lg">GPT-5.4 (Flagship)</h3>
              <p className="text-slate-400 text-sm mb-2">$2.50 In / $15.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$151.27</span></p>
                <p>1k/day: <span className="float-right">$756.38</span></p>
                <p>5k/day: <span className="float-right">$3,781.88</span></p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={openaiData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="scenario" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="GPT-4o Mini" fill={colors.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="GPT-5.4 Mini" fill={colors.mid} radius={[4, 4, 0, 0]} />
                <Bar dataKey="GPT-5.4" fill={colors.flagship} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    },
    {
      id: "anthropic",
      title: "Anthropic Next-Gen Models",
      subtitle: "Monthly 30-Day Projections (USD)",
      content: (
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-emerald-400 font-semibold text-lg">Haiku 4.5 (Budget)</h3>
              <p className="text-slate-400 text-sm mb-2">$1.00 In / $5.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$54.55</span></p>
                <p>1k/day: <span className="float-right">$272.73</span></p>
                <p>5k/day: <span className="float-right">$1,363.65</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-blue-400 font-semibold text-lg">Sonnet 4.6 (Mid)</h3>
              <p className="text-slate-400 text-sm mb-2">$3.00 In / $15.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$163.64</span></p>
                <p>1k/day: <span className="float-right">$818.19</span></p>
                <p>5k/day: <span className="float-right">$4,090.95</span></p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-purple-400 font-semibold text-lg">Opus 4.7 (Flagship)</h3>
              <p className="text-slate-400 text-sm mb-2">$5.00 In / $25.00 Out per 1M</p>
              <div className="text-white font-mono text-sm space-y-1 mt-4">
                <p>200/day: <span className="float-right">$272.73</span></p>
                <p>1k/day: <span className="float-right">$1,363.65</span></p>
                <p>5k/day: <span className="float-right">$6,818.25</span></p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anthropicData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="scenario" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Haiku 4.5" fill={colors.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sonnet 4.6" fill={colors.mid} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Opus 4.7" fill={colors.flagship} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    },
    {
      id: "recommendation",
      title: "Optimal Model Selection",
      subtitle: "Why GPT-4o Mini is the perfect fit for NetoMate's Architecture",
      content: (
        <div className="flex flex-col md:flex-row gap-8 h-full">
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-center space-x-4 mb-2">
              <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/50">
                <FileJson size={40} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">GPT-4o Mini</h2>
                <p className="text-emerald-400 font-medium text-lg">The Clear Winner for NetoMate</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50 flex items-start space-x-4">
                <div className="bg-blue-500/20 p-2 rounded-lg mt-1"><FileJson size={20} className="text-blue-400" /></div>
                <div>
                  <h4 className="text-white font-bold mb-1">Native Structured Outputs (JSON)</h4>
                  <p className="text-slate-400 text-sm">Step D of your pipeline demands strict JSON without conversational filler. GPT-4o Mini natively supports `response_format: {"{ \"type\": \"json_object\" }"}` yielding a 100% parse success rate.</p>
                </div>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50 flex items-start space-x-4">
                <div className="bg-purple-500/20 p-2 rounded-lg mt-1"><ShieldCheck size={20} className="text-purple-400" /></div>
                <div>
                  <h4 className="text-white font-bold mb-1">Leveraging Existing Guardrails</h4>
                  <p className="text-slate-400 text-sm">Because NetoMate has rigid pre-processing (Step B state checks) and post-processing (Step E hallucination filters), you don't need a flagship model's reasoning. You just need a robust pattern matcher.</p>
                </div>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50 flex items-start space-x-4">
                <div className="bg-emerald-500/20 p-2 rounded-lg mt-1"><DollarSign size={20} className="text-emerald-400" /></div>
                <div>
                  <h4 className="text-white font-bold mb-1">Unbeatable Cost Efficiency</h4>
                  <p className="text-slate-400 text-sm">At just $182/month for massive volume (5,000 req/day), it is effectively 7.5x cheaper than Haiku 4.5 and 15x cheaper than Gemini 3 Pro, leaving massive budget for UI/hosting infrastructure.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
               <h3 className="text-white font-bold mb-6 text-center">Cost Comparison at Max Scale (150k Req/mo)</h3>
               <div className="space-y-6">
                 <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-emerald-400 font-bold">GPT-4o Mini</span>
                      <span className="text-white font-mono">$182</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div className="bg-emerald-400 h-3 rounded-full" style={{ width: '4%' }}></div>
                    </div>
                 </div>
                 
                 <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300 font-bold">Gemini 2.5 Flash</span>
                      <span className="text-white font-mono">$558</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div className="bg-slate-400 h-3 rounded-full" style={{ width: '13%' }}></div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300 font-bold">Haiku 4.5</span>
                      <span className="text-white font-mono">$1,363</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div className="bg-slate-400 h-3 rounded-full" style={{ width: '33%' }}></div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-500 font-bold">Opus 4.7 (Flagship)</span>
                      <span className="text-slate-400 font-mono">$6,818</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div className="bg-slate-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "deepdive",
      title: "Comprehensive Breakdown: GPT-4o Mini",
      subtitle: "Detailed Cost Scaling for NetoMate Production Deployment",
      content: (
        <div className="flex flex-col h-full bg-slate-800/30 p-6 rounded-2xl border border-slate-700">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <div className="bg-slate-800 border border-slate-600 p-4 rounded-xl text-center shadow-lg">
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Cost Per Request</p>
                <p className="text-3xl text-white font-mono font-bold">$0.0012</p>
                <p className="text-emerald-400 text-xs mt-2">Almost zero marginal cost</p>
             </div>
             <div className="bg-slate-800 border border-slate-600 p-4 rounded-xl text-center shadow-lg">
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Input (4,121 Tok)</p>
                <p className="text-2xl text-blue-300 font-mono font-bold">$0.0006</p>
                <p className="text-slate-500 text-xs mt-2">$0.15 per 1M</p>
             </div>
             <div className="bg-slate-800 border border-slate-600 p-4 rounded-xl text-center shadow-lg">
                <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Output (994 Tok)</p>
                <p className="text-2xl text-purple-300 font-mono font-bold">$0.0006</p>
                <p className="text-slate-500 text-xs mt-2">$0.60 per 1M</p>
             </div>
             <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-xl text-center shadow-lg">
                <p className="text-emerald-400 text-sm mb-1 uppercase tracking-wider font-semibold">5000 Req / Day</p>
                <p className="text-3xl text-emerald-300 font-mono font-bold">$182.18</p>
                <p className="text-emerald-500/70 text-xs mt-2">Monthly Total</p>
             </div>
           </div>

           <div className="flex-1 mt-4 border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-6 py-4 font-semibold border-b border-slate-700">Client Size</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-700">Volume</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-700">Input Cost</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-700">Output Cost</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-700 text-right">Total Montly Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                  <tr className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-sans text-emerald-400 font-medium">Small Dev Team</td>
                    <td className="px-6 py-4">200 / day (6k/mo)</td>
                    <td className="px-6 py-4">$3.71</td>
                    <td className="px-6 py-4">$3.58</td>
                    <td className="px-6 py-4 text-right text-white font-bold">$7.29</td>
                  </tr>
                  <tr className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-sans text-blue-400 font-medium">Mid-Sized Org</td>
                    <td className="px-6 py-4">1,000 / day (30k/mo)</td>
                    <td className="px-6 py-4">$18.54</td>
                    <td className="px-6 py-4">$17.89</td>
                    <td className="px-6 py-4 text-right text-white font-bold">$36.44</td>
                  </tr>
                  <tr className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-sans text-purple-400 font-medium">Enterprise Load</td>
                    <td className="px-6 py-4">5,000 / day (150k/mo)</td>
                    <td className="px-6 py-4">$92.72</td>
                    <td className="px-6 py-4">$89.46</td>
                    <td className="px-6 py-4 text-right text-white font-bold bg-emerald-900/20">$182.18</td>
                  </tr>
                </tbody>
              </table>
           </div>
        </div>
      )
    }
  ];

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  return (
    <div className="flex flex-col h-screen bg-slate-900 font-sans overflow-hidden text-slate-200 selection:bg-blue-500/30">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur z-10">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-wide">NetoMate Overview</span>
        </div>
        <div className="flex items-center space-x-1">
          {slides.map((_, index) => (
            <div 
              key={index} 
              className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700 cursor-pointer hover:bg-slate-600'}`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      </header>

      {/* Main Slide Area */}
      <main className="flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={slide.id} className="w-full h-full flex-shrink-0 p-8 md:p-12 lg:p-16 overflow-y-auto">
              {slide.title && (
                <div className="mb-8">
                  <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">{slide.title}</h2>
                  {slide.subtitle && <p className="text-xl text-slate-400 font-light">{slide.subtitle}</p>}
                </div>
              )}
              <div className={slide.title ? "h-[calc(100%-100px)]" : "h-full"}>
                {slide.content}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="h-20 border-t border-slate-800 flex items-center justify-between px-6 bg-slate-900 z-10">
        <div className="text-slate-500 text-sm font-medium">
          Slide {currentSlide + 1} of {slides.length}
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-all ${currentSlide === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700 hover:shadow-md'}`}
          >
            <ChevronLeft size={18} />
            <span>Previous</span>
          </button>
          <button 
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-all ${currentSlide === slides.length - 1 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg shadow-blue-600/20'}`}
          >
            <span>Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Presentation;
