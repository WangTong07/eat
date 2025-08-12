"use client";
import { useState } from "react";

export default function TestAIPage() {
  const [dish, setDish] = useState("椒盐虾");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testAI = async () => {
    setLoading(true);
    setResult("");
    
    try {
      const response = await fetch('/api/ai-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dish })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(`✅ 成功: ${data.ingredients.join(', ')}`);
      } else {
        setResult(`❌ 失败: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ 错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          🧪 AI食材识别测试
        </h1>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="space-y-4">
            <div>
              <label className="block text-white mb-2">测试菜品：</label>
              <input
                type="text"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入菜品名称"
              />
            </div>
            
            <button
              onClick={testAI}
              disabled={loading || !dish.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "🔄 分析中..." : "🚀 测试AI识别"}
            </button>
            
            {result && (
              <div className="mt-4 p-4 rounded-lg bg-black/30 border border-white/20">
                <h3 className="text-white font-medium mb-2">测试结果：</h3>
                <p className="text-white/90">{result}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-white/70 text-sm">
            这个页面用于测试线上AI功能是否正常工作
          </p>
          <p className="text-white/50 text-xs mt-2">
            配置环境变量后，椒盐虾应该识别为"虾"
          </p>
        </div>
      </div>
    </div>
  );
}