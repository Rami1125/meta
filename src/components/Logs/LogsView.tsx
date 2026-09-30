import React, { useState } from 'react';
import { 
  Download, 
  Search, 
  Filter, 
  Trash2, 
  RefreshCw, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Tag,
  Radio,
  X
} from 'lucide-react';
import { LogEntry, StudioTask } from '../../types/studio';
import { TaskModal } from '../Chat/TaskModal';
import { api } from '../../services/api';

interface LogsViewProps {
  logs: LogEntry[];
  onRefresh: () => void;
  onClearLogs: () => Promise<void>;
  onCreateTask: (task: Partial<StudioTask>) => Promise<void>;
}

export const LogsView: React.FC<LogsViewProps> = ({
  logs,
  onRefresh,
  onClearLogs,
  onCreateTask,
}) => {
  const [menuFilter, setMenuFilter] = useState('all');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<LogEntry | null>(null);
  const [taskModalData, setTaskModalData] = useState<any>(null);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesMenu = menuFilter === 'all' || 
      log.selected_menu_id === menuFilter ||
      log.selected_menu_title?.includes(menuFilter);

    const matchesPhone = !phoneSearch || 
      log.from.includes(phoneSearch) ||
      (log.customer_name && log.customer_name.includes(phoneSearch)) ||
      log.incoming_text.includes(phoneSearch);

    return matchesMenu && matchesPhone;
  });

  // Export to Excel / CSV with UTF-8 BOM for proper Hebrew display in Excel
  const exportToExcel = () => {
    const headers = ['מזהה', 'תאריך ושעה', 'טלפון שולח', 'שם לקוח', 'הודעת לקוח', 'תפריט שנבחר', 'תשובה שנשלחה', 'סוג מענה', 'ערוץ', 'סטטוס', 'מזהה משימה'];
    
    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.timestamp).toLocaleString('he-IL'),
      l.from,
      l.customer_name || '',
      `"${(l.incoming_text || '').replace(/"/g, '""')}"`,
      `"${(l.selected_menu_title || l.selected_menu_id || '').replace(/"/g, '""')}"`,
      `"${(l.sent_response || '').replace(/"/g, '""')}"`,
      l.response_type,
      l.channel,
      l.status,
      l.task_id || ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `saban_whatsapp_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isSyncingToSheet, setIsSyncingToSheet] = useState(false);
  const [syncSheetSuccess, setSyncSheetSuccess] = useState(false);

  const syncToGoogleSheet = async () => {
    setIsSyncingToSheet(true);
    try {
      await api.postToGoogleSheets({
        action: 'logWhatsApp',
        timestamp: new Date().toLocaleString('he-IL'),
        phone: filteredLogs[0]?.from || '+972508860896',
        customerName: filteredLogs[0]?.customer_name || 'סנכרון יומנים מרוכז',
        inquiryType: 'סנכרון יומן ידני',
        incomingMessage: `סונכרנו ${filteredLogs.length} רשומות יומן מה-PWA לגיליון`,
        branchName: 'יומן אירועים וסנכרון',
        sentReply: 'סנכרון יומנים הושלם בהצלחה',
        status: 'טופל בהצלחה'
      });
      setSyncSheetSuccess(true);
      setTimeout(() => setSyncSheetSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to sync to Google Sheet:', err);
    }
    setIsSyncingToSheet(false);
  };

  const getMenuBadge = (menuId?: string, title?: string) => {
    if (menuId === 'delivery' || title?.includes('הובלה')) {
      return <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-semibold">🚚 הובלה</span>;
    }
    if (menuId === 'pickup' || title?.includes('איסוף')) {
      return <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">🏪 איסוף</span>;
    }
    if (menuId === 'containers' || title?.includes('מכולה')) {
      return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-semibold">🗑️ מכולות</span>;
    }
    if (menuId === 'tracking' || title?.includes('מעקב')) {
      return <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-semibold">📍 מעקב</span>;
    }
    return <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-medium">כללי</span>;
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden text-right pb-16 md:pb-0">
      
      {/* Top Controls & Filters */}
      <div className="p-3 md:p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        
        {/* Title and stats */}
        <div>
          <h2 className="font-bold text-slate-100 text-sm md:text-base flex items-center gap-2">
            <span>יומני WhatsApp (Logs)</span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {filteredLogs.length}
            </span>
          </h2>
          <p className="text-[11px] md:text-xs text-slate-400">
            מעקב פניות, תפריטים ומענה אוטומטי
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={syncToGoogleSheet}
            disabled={isSyncingToSheet}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 ${
              syncSheetSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40'
            }`}
            title="סנכרן רשומות לגיליון Google Sheets של ח. סבן"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToSheet ? 'animate-spin' : ''}`} />
            <span>{isSyncingToSheet ? 'מסנכרן...' : syncSheetSuccess ? 'סונכרן בהצלחה! ✓' : 'סנכרן לגיליון סבן'}</span>
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-800/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
            <span>Excel</span>
          </button>

          <button
            onClick={onRefresh}
            title="רענן יומנים"
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={async () => {
              if (confirm('האם אתה בטוח שברצונך לנקות את היומנים?')) {
                await onClearLogs();
              }
            }}
            title="נקה יומנים"
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 rounded-xl transition-colors active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-3 md:px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            placeholder="סינון לפי טלפון, שם או טקסט..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
          />
        </div>

        {/* Menu category filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-1">
          {[
            { id: 'all', label: 'הכל' },
            { id: 'delivery', label: '🚚 הובלה' },
            { id: 'pickup', label: '🏪 איסוף' },
            { id: 'containers', label: '🗑️ מכולות' },
            { id: 'tracking', label: '📍 מעקב' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMenuFilter(item.id)}
              className={`px-3 py-1.5 min-h-[38px] rounded-xl text-xs transition-colors active:scale-95 shrink-0 ${
                menuFilter === item.id
                  ? 'bg-orange-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-right text-xs border-collapse">
          <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400 font-semibold select-none">
            <tr>
              <th className="p-3 w-32">תאריך ושעה</th>
              <th className="p-3 w-36">מ- (שולח)</th>
              <th className="p-3 w-64">הודעת לקוח</th>
              <th className="p-3 w-36">תפריט שנבחר</th>
              <th className="p-3">תשובה שנשלחה</th>
              <th className="p-3 w-32">סטטוס משימה</th>
              <th className="p-3 w-28 text-center">ערוץ וסטטוס</th>
              <th className="p-3 w-16 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200">
            {filteredLogs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleString('he-IL', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <tr 
                  key={log.id} 
                  className="hover:bg-slate-900/60 transition-colors group cursor-pointer"
                  onClick={() => setSelectedLogForDetails(log)}
                >
                  {/* Date */}
                  <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {dateStr}
                  </td>

                  {/* From */}
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-100">{log.customer_name || 'לקוח'}</div>
                    <div className="font-mono text-emerald-400 text-[11px] dir-ltr text-right">
                      {log.from}
                    </div>
                  </td>

                  {/* Customer message */}
                  <td className="p-3">
                    <div className="line-clamp-2 text-slate-300 font-medium">
                      {log.incoming_text}
                    </div>
                  </td>

                  {/* Selected menu */}
                  <td className="p-3 whitespace-nowrap">
                    {getMenuBadge(log.selected_menu_id, log.selected_menu_title)}
                  </td>

                  {/* Sent response */}
                  <td className="p-3">
                    <div className="line-clamp-2 text-slate-300 text-xs font-mono bg-slate-950/40 p-1.5 rounded-lg border border-slate-800">
                      {log.sent_response}
                    </div>
                  </td>

                  {/* Task Status */}
                  <td className="p-3 whitespace-nowrap">
                    {log.task_id ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-semibold">
                        ✅ משימה נוצרה
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTaskModalData({
                            clientPhone: log.from,
                            clientName: log.customer_name || '',
                            title: `משימה מ${log.from}: ${log.selected_menu_title || 'פנייה'}`,
                            description: `הודעה: ${log.incoming_text}`,
                            category: (log.selected_menu_id as any) || 'delivery'
                          });
                        }}
                        className="text-[10px] text-orange-400 hover:text-orange-300 hover:underline"
                      >
                        + צור משימה
                      </button>
                    )}
                  </td>

                  {/* Channel & Status */}
                  <td className="p-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                      {log.channel.toUpperCase()} • {log.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-center whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLogForDetails(log);
                      }}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                      title="הצג פרטים מלאים"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500 text-xs">
                  אין יומנים זמינים התואמים את הסינון.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Log Detail Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-right">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-slate-100 text-sm">פרטי רשומת יומן WhatsApp</h3>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-200">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">מזהה פנייה:</span>
                  <span className="font-mono text-slate-200">{selectedLogForDetails.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">תאריך ושעה:</span>
                  <span className="font-mono text-slate-200">
                    {new Date(selectedLogForDetails.timestamp).toLocaleString('he-IL')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">טלפון שולח:</span>
                  <span className="font-mono text-emerald-400 dir-ltr text-right inline-block">
                    {selectedLogForDetails.from}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ענף תפריט שנבחר:</span>
                  <span>{selectedLogForDetails.selected_menu_title || selectedLogForDetails.selected_menu_id || 'תפריט ראשי'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">הודעת הלקוח:</label>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 whitespace-pre-wrap">
                  {selectedLogForDetails.incoming_text}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">מענה שנשלח אוטומטית:</label>
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-emerald-200 whitespace-pre-wrap">
                  {selectedLogForDetails.sent_response}
                </div>
              </div>

              {selectedLogForDetails.raw_payload && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">נתוני Payload גולמיים:</label>
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto dir-ltr text-left">
                    {JSON.stringify(selectedLogForDetails.raw_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal for creating task from row */}
      {taskModalData && (
        <TaskModal
          isOpen={Boolean(taskModalData)}
          onClose={() => setTaskModalData(null)}
          onSubmit={onCreateTask}
          initialData={taskModalData}
        />
      )}
    </div>
  );
};
