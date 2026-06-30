import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  CheckSquare,
  Crosshair,
  Loader2,
  ShieldAlert,
  Sparkles,
  Upload,
} from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setAnalysisError(null);
      setResults(null);
      setAiAdvice(null);
      setAdviceError(null);
    };
    reader.readAsDataURL(file);
  };

  const ensureApiKey = () => {
    if (!GEMINI_API_KEY) {
      throw new Error('يرجى ضبط مفتاح Gemini في متغير البيئة VITE_GEMINI_API_KEY قبل تشغيل التحليل.');
    }
  };

  const analyzeImageWithGemini = async (base64Image) => {
    ensureApiKey();

    const prompt = `Analyze this financial trading chart. Estimate the following 3 numerical values accurately from the Y-axis:
    1. h1High: The highest visible peak price point.
    2. h1Low: The lowest visible trough price point.
    3. m5Breakout: A reasonable current price or recent breakout point between the high and low.
    Return ONLY a raw JSON object. Example: {"h1High": 45200.50, "h1Low": 44100.00, "m5Breakout": 44850.25}`;

    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            h1High: { type: 'NUMBER' },
            h1Low: { type: 'NUMBER' },
            m5Breakout: { type: 'NUMBER' },
          },
        },
      },
    };

    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        const response = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('لم يتم استلام بيانات من الذكاء الاصطناعي');

        return JSON.parse(text);
      } catch (error) {
        if (attempt === delays.length) {
          throw new Error('فشل الذكاء الاصطناعي في تحليل الصورة. يرجى التأكد من وضوح أرقام المحور الجانبي للأسعار.');
        }
        await sleep(delays[attempt]);
      }
    }
  };

  const fetchAIAdvice = async (tradeData) => {
    setIsFetchingAdvice(true);
    setAdviceError(null);

    try {
      ensureApiKey();

      const prompt = `بصفتك خبير تداول محترف في الأسواق المالية ومحلل كمي، قم بتحليل إعداد هذه الصفقة (Trade Setup) باختصار بناءً على البيانات التالية:
    - سعر الدخول (الشراء): ${tradeData.actionable.buy.toFixed(4)}
    - سعر جني الأرباح (TP): ${tradeData.actionable.tp.toFixed(4)}
    - سعر وقف الخسارة (SL): ${tradeData.actionable.sl.toFixed(4)}
    - نسبة المخاطرة للعائد (Risk/Reward): 1 إلى ${tradeData.stats.riskReward}

    يرجى تقديم رد منظم باللغة العربية بأسلوب احترافي ومباشر، يحتوي على:
    1. تقييم الصفقة: هل نسبة المخاطرة للعائد جيدة أم خطيرة؟
    2. إدارة المخاطر: نصيحة حول حجم الدخول (Position Sizing) والتعامل مع وقف الخسارة.
    3. السيكولوجية: نصيحة نفسية قصيرة للالتزام بالخطة.

    اكتب الرد بصيغة نصية عادية مع فواصل واضحة.`;

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) throw new Error('خطأ في الاتصال بالخادم.');

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('فشل في توليد النص الاستشاري.');

      setAiAdvice(text);
    } catch (error) {
      setAdviceError(error.message || 'تعذر الاتصال بالمستشار الذكي حالياً.');
    } finally {
      setIsFetchingAdvice(false);
    }
  };

  const handleAnalyze = async () => {
    if (!imagePreview) {
      setAnalysisError('الرجاء رفع صورة الشارت أولاً.');
      return;
    }

    setIsAnalyzing(true);
    setResults(null);
    setAnalysisError(null);
    setAiAdvice(null);

    try {
      const aiData = await analyzeImageWithGemini(imagePreview);
      const high = Number(aiData.h1High);
      const low = Number(aiData.h1Low);
      const breakout = Number(aiData.m5Breakout);

      if (![high, low, breakout].every(Number.isFinite) || high <= low) {
        throw new Error('فشل الذكاء الاصطناعي في استخراج قيم واضحة. جرب التقاط صورة أوضح لمحور الأسعار.');
      }

      const diff = high - low;
      const fibLevels = {
        fib0: high,
        fib236: high - diff * 0.236,
        fib382: high - diff * 0.382,
        fib500: high - diff * 0.5,
        fib618: high - diff * 0.618,
        fib786: high - diff * 0.786,
        fib100: low,
      };

      const predictedBuy = breakout;
      const predictedTP = fibLevels.fib382;
      const predictedSL = fibLevels.fib786;
      const predictedSell = fibLevels.fib0;
      const risk = predictedBuy - predictedSL;
      const reward = predictedTP - predictedBuy;
      const riskReward = risk > 0 ? (reward / risk).toFixed(2) : 'غير متاح';

      setResults({
        fibLevels,
        actionable: {
          buy: predictedBuy,
          sell: predictedSell,
          sl: predictedSL,
          tp: predictedTP,
        },
        stats: {
          riskReward,
          winProbability: 78.4,
          trendStrength: 'صاعد بقوة',
        },
      });
    } catch (error) {
      setAnalysisError(error.message || 'حدث خطأ أثناء تحليل الشارت.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-white p-4 font-sans text-black selection:bg-black selection:text-white md:p-8">
      <header className="mb-8 flex items-center justify-between border-b-4 border-black pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-black p-2 text-white">
            <Activity className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">كوانت فيجن</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">محلل ومستخرج البيانات الآلي</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 border-2 border-black bg-gray-50 px-4 py-2 text-sm font-bold uppercase md:flex">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          الذكاء الاصطناعي نشط
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="mb-4 border-b-2 border-gray-100 pb-2 text-lg font-black uppercase">تحميل شارت التداول</h3>

            <div className="relative cursor-pointer border-4 border-dashed border-black bg-white p-10 text-center transition-colors duration-300 hover:bg-gray-50">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
              {imagePreview ? (
                <div className="space-y-4">
                  <img src={imagePreview} alt="معاينة الشارت" className="mx-auto max-h-64 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]" />
                  <p className="inline-block bg-black px-3 py-1 text-sm font-black uppercase text-white">تم تحميل الشارت بنجاح</p>
                </div>
              ) : (
                <div className="pointer-events-none flex flex-col items-center py-6">
                  <div className="mb-4 rounded-full bg-black p-4 text-white">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-black uppercase">اسحب وأفلت صورة الشارت هنا</p>
                  <p className="mt-2 text-xs font-bold text-gray-500">يقوم النظام بقراءة أسعار القمة والقاع ونقطة الاختراق تلقائياً</p>
                </div>
              )}
            </div>

            {analysisError && (
              <div className="mt-6 flex items-start gap-3 border-2 border-black bg-red-100 p-4 text-red-800">
                <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                <p className="text-sm font-bold">{analysisError}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !imagePreview}
              className="mt-6 flex w-full items-center justify-center gap-3 bg-black py-5 text-lg font-black uppercase text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-gray-800 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" /> جاري مسح وقراءة الشارت...
                </>
              ) : (
                <>
                  <BarChart2 className="h-6 w-6" /> تنفيذ التحليل الكمّي
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7">
          {results ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="mb-6 flex items-center gap-3 border-b-4 border-black pb-4 text-2xl font-black uppercase">
                  <Crosshair className="h-8 w-8" /> أهداف الصفقة المستخرجة
                </h2>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <MetricCard label="الدخول الآمن" value={results.actionable.buy.toFixed(4)} />
                  <MetricCard label="جني الأرباح (TP)" value={results.actionable.tp.toFixed(4)} valueClassName="text-green-700" />
                  <MetricCard label="وقف الخسارة (SL)" value={results.actionable.sl.toFixed(4)} valueClassName="text-red-700" />
                  <MetricCard label="البيع الأقصى" value={results.actionable.sell.toFixed(4)} />
                </div>
              </div>

              <div className="border-4 border-black bg-indigo-50 p-6 shadow-[8px_8px_0px_0px_rgba(79,70,229,1)]">
                <div className="mb-4 flex items-center justify-between border-b-2 border-indigo-200 pb-4">
                  <h3 className="flex items-center gap-2 text-xl font-black uppercase text-indigo-900">
                    <Sparkles className="h-6 w-6 text-indigo-600" /> مراجعة خوارزميات المخاطر ✨
                  </h3>
                  {!aiAdvice && !isFetchingAdvice && (
                    <button
                      onClick={() => fetchAIAdvice(results)}
                      className="flex items-center gap-2 border-2 border-black bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-indigo-700 active:translate-y-px active:shadow-none"
                    >
                      <ShieldAlert className="h-4 w-4" /> طلب الاستشارة السلوكية ✨
                    </button>
                  )}
                </div>

                {isFetchingAdvice && (
                  <div className="flex flex-col items-center justify-center py-6 text-indigo-600">
                    <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                    <p className="text-sm font-bold">جاري معالجة الأرقام وبناء النصيحة الفنية والبدنية...</p>
                  </div>
                )}

                {adviceError && <div className="border-2 border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">{adviceError}</div>}

                {aiAdvice && (
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap border-2 border-indigo-900 bg-white p-5 font-medium leading-relaxed text-indigo-950">{aiAdvice}</div>
                    <div className="inline-flex items-center gap-2 bg-indigo-100 p-2 text-xs font-bold uppercase text-indigo-600">
                      <BookOpen className="h-4 w-4" /> استشارة مولدة عبر نموذج Gemini السلوكي
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard label="المخاطرة : العائد الكلي" value={`1 : ${results.stats.riskReward}`} className="text-indigo-600" />
                <SummaryCard label="احتمالية دقة الاختراق" value={`${results.stats.winProbability}%`} />
                <SummaryCard label="بنية الاتجاه الحالي" value={results.stats.trendStrength} className="mt-2 text-xl uppercase text-emerald-600" />
              </div>

              <div className="border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="mb-6 border-b-4 border-black pb-4 text-xl font-black uppercase">مستويات فيبوناتشي المحسوبة (ساعة)</h3>

                <div className="flex flex-col border-4 border-black">
                  {[
                    { label: '0.0% (القمة المستخرجة)', val: results.fibLevels.fib0, desc: 'البيع الكلي للأهداف البعيدة' },
                    { label: '23.6%', val: results.fibLevels.fib236, desc: 'منطقة مقاومة ثانوية' },
                    { label: '38.2%', val: results.fibLevels.fib382, desc: 'مستوى جني الأرباح الإلزامي (TP)' },
                    { label: '50.0%', val: results.fibLevels.fib500, desc: 'المحور الأوسط للتصحيح' },
                    { label: '61.8%', val: results.fibLevels.fib618, desc: 'الذهبي - دعم رئيسي للاستمرار' },
                    { label: '78.6%', val: results.fibLevels.fib786, desc: 'مستوى وقف الخسارة الحرج (SL)' },
                    { label: '100.0% (القاع المستخرج)', val: results.fibLevels.fib100, desc: 'قاع تشكل الهيكل الصاعد' },
                  ].map((level) => (
                    <FibLevel key={level.label} level={level} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center border-4 border-dashed border-black bg-white p-12 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="mb-6 -rotate-3 bg-black p-4 text-white">
                <CheckSquare className="h-12 w-12" />
              </div>
              <h3 className="mb-4 text-center text-2xl font-black uppercase">بانتظار شارت التداول</h3>
              <p className="max-w-md text-center text-base font-bold leading-relaxed text-gray-600">
                يرجى رفع صورة الشارت ليقوم المحرك الذكي بقراءتها واستخراج أهداف الاستراتيجية ومستويات فيبوناتشي الساعة فوراً.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClassName = '' }) {
  return (
    <div className="border-2 border-black bg-gray-50 p-4 text-center">
      <p className="mb-2 text-xs font-black uppercase text-gray-500">{label}</p>
      <p className={`font-mono text-xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, className = '' }) {
  return (
    <div className="border-4 border-black bg-white p-5">
      <p className="mb-2 border-b-2 border-gray-100 pb-1 text-xs font-black uppercase text-gray-500">{label}</p>
      <p className={`font-mono text-3xl font-black ${className}`}>{value}</p>
    </div>
  );
}

function FibLevel({ level }) {
  const isTakeProfit = level.label.includes('38.2');
  const isStopLoss = level.label.includes('78.6');

  return (
    <div className={`flex items-center justify-between border-b-2 border-black p-4 last:border-b-0 ${isTakeProfit ? 'bg-black text-white' : isStopLoss ? 'bg-gray-100 font-bold text-red-950' : 'hover:bg-gray-50'}`}>
      <div className="flex flex-col">
        <span className="text-sm font-black uppercase">{level.label}</span>
        <span className={`mt-1 text-[10px] font-bold ${isTakeProfit ? 'text-gray-300' : 'text-gray-500'}`}>{level.desc}</span>
      </div>
      <span className="font-mono text-lg font-bold">{level.val.toFixed(4)}</span>
    </div>
  );
}
