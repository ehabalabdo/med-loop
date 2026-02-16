
import React, { useState, useEffect } from 'react';
import { DeviceService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { DeviceResult } from '../types';

interface DeviceResultsTimelineProps {
  patientId: string;
}

const DeviceResultsTimeline: React.FC<DeviceResultsTimelineProps> = ({ patientId }) => {
  const { user } = useAuth();
  const [results, setResults] = useState<DeviceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user || !patientId) return;
      try {
        const data = await DeviceService.getPatientResults(user, patientId);
        setResults(data);
      } catch (err) {
        console.error('Error loading device results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, 15000);
    return () => clearInterval(interval);
  }, [user, patientId]);

  const getDeviceIcon = (type?: string) => {
    switch (type) {
      case 'cbc': return 'fa-solid fa-droplet';
      case 'ecg': return 'fa-solid fa-heart-pulse';
      case 'glucose': return 'fa-solid fa-syringe';
      case 'chemistry': return 'fa-solid fa-flask';
      case 'xray': return 'fa-solid fa-x-ray';
      default: return 'fa-solid fa-microscope';
    }
  };

  const getDeviceColor = (type?: string) => {
    switch (type) {
      case 'cbc': return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
      case 'ecg': return { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' };
      case 'glucose': return { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' };
      case 'chemistry': return { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' };
      case 'xray': return { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' };
      default: return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
  };

  // Group results by date
  const groupedResults = results.reduce<Record<string, DeviceResult[]>>((groups, result) => {
    const dateKey = new Date(result.createdAt).toLocaleDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(result);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-primary"></i>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <i className="fa-solid fa-microscope text-3xl text-slate-300"></i>
        </div>
        <p className="text-lg font-semibold text-slate-500">لا توجد نتائج أجهزة</p>
        <p className="text-sm mt-1">ستظهر النتائج هنا عند وصولها من الأجهزة الطبية</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
          <i className="fa-solid fa-vials text-blue-500"></i>
          <span className="text-blue-700 font-bold">{results.length}</span>
          <span className="text-blue-500 text-xs">إجمالي النتائج</span>
        </div>
        {results.some(r => r.isAbnormal) && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
            <span className="text-red-700 font-bold">{results.filter(r => r.isAbnormal).length}</span>
            <span className="text-red-500 text-xs">غير طبيعية</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative pr-8 border-r-2 border-slate-100 space-y-8 py-2">
        {Object.keys(groupedResults).map((dateKey) => {
          const dateResults = groupedResults[dateKey];
          return (
          <div key={dateKey}>
            {/* Date Header */}
            <div className="relative">
              <div className="absolute -right-[41px] top-0 w-5 h-5 rounded-full border-4 border-white bg-primary shadow-sm"></div>
              <div className="text-sm font-bold text-primary mb-3">{formatDate(dateResults[0].createdAt)}</div>
            </div>

            {/* Results for this date */}
            <div className="space-y-3 mr-1">
              {dateResults.map((result: DeviceResult) => {
                const colors = getDeviceColor(result.deviceType);
                const isExpanded = expandedResult === result.id;

                return (
                  <div 
                    key={result.id}
                    className={`bg-white rounded-xl border ${result.isAbnormal ? 'border-red-200 shadow-red-100/50' : 'border-gray-100'} shadow-sm overflow-hidden transition-all hover:shadow-md`}
                  >
                    {/* Result Header */}
                    <button 
                      onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                      className="w-full flex items-center gap-3 p-3 text-right"
                    >
                      {/* Device Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors.bg} ${colors.text}`}>
                        <i className={getDeviceIcon(result.deviceType)}></i>
                      </div>

                      {/* Test Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{result.testCode}</span>
                          {result.testName && <span className="text-xs text-slate-400 truncate">({result.testName})</span>}
                          {result.isAbnormal && (
                            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">⚠ غير طبيعي</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{result.deviceName || 'جهاز'}</span>
                          <span>•</span>
                          <span>{formatTime(result.createdAt)}</span>
                        </div>
                      </div>

                      {/* Value */}
                      <div className="text-left shrink-0">
                        <div className={`font-mono font-bold text-lg ${result.isAbnormal ? 'text-red-600' : 'text-slate-800'}`}>
                          {result.value}
                        </div>
                        {result.unit && <div className="text-[10px] text-slate-400 text-left">{result.unit}</div>}
                      </div>

                      <i className={`fa-solid fa-chevron-down text-slate-300 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-slate-50 text-sm space-y-2">
                        {result.referenceRange && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">المدى المرجعي</span>
                            <span className="font-mono text-slate-700">{result.referenceRange}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">معرّف الجهاز</span>
                          <span className="font-mono text-xs text-slate-600">{result.deviceId.substring(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">تم الربط بواسطة</span>
                          <span className="text-slate-700">{result.matchedBy === 'auto' ? 'تلقائي 🤖' : result.matchedBy || '-'}</span>
                        </div>
                        {result.matchedAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">وقت الربط</span>
                            <span className="text-slate-700">{formatDate(result.matchedAt)} {formatTime(result.matchedAt)}</span>
                          </div>
                        )}
                        {result.rawMessage && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">عرض البيانات الخام</summary>
                            <pre className="mt-1 text-[10px] bg-slate-800 text-green-400 p-2 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                              {result.rawMessage}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default DeviceResultsTimeline;
