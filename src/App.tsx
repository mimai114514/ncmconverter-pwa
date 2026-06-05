import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Music, 
  UploadCloud, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Download, 
  Trash2, 
  Play, 
  Moon, 
  Sun, 
  Github, 
  Plus, 
  Minus,
  Sparkles,
  Info
} from 'lucide-react';
import { parseNcmMetadata } from './core/ncmDecrypt';
import { decryptWithWorker } from './workers/worker-client';
import { settingsService, AppSettings } from './services/settings';

interface NcmFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress: number;
  outputName?: string;
  outputBytes?: Uint8Array;
  errorMessage?: string;
  metadata?: {
    musicName?: string;
    artist?: string[][];
    album?: string;
    format?: string;
  };
}

export default function App() {
  const [files, setFiles] = useState<NcmFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isDark, setIsDark] = useState(true);
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(settingsService.get());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const dark = savedTheme ? savedTheme === 'dark' : true;
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    const updated = settingsService.set({ [key]: value });
    setSettings(updated);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const ncmFiles = newFiles.filter(f => f.name.toLowerCase().endsWith('.ncm'));
    if (ncmFiles.length === 0) return;

    setFiles(prev => {
      const updated = [...prev];
      ncmFiles.forEach(file => {
        // Prevent duplicate files by name and size
        if (!updated.some(f => f.name === file.name && f.size === file.size)) {
          updated.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0
          });
        }
      });
      return updated;
    });
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearList = () => {
    if (isProcessing) return;
    setFiles([]);
  };

  const triggerDownload = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: 'audio/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingle = (item: NcmFileItem) => {
    if (item.status === 'success' && item.outputBytes && item.outputName) {
      triggerDownload(item.outputBytes, item.outputName);
    }
  };

  const handleDownloadAll = () => {
    files.forEach(item => {
      if (item.status === 'success' && item.outputBytes && item.outputName) {
        triggerDownload(item.outputBytes, item.outputName);
      }
    });
  };

  // Core concurrent queue processor
  const startProcessing = async () => {
    if (isProcessing || files.length === 0) return;
    setIsProcessing(true);

    const pendingList = files.filter(f => f.status !== 'success');
    if (pendingList.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Reset status of non-success files
    setFiles(prev => prev.map(f => 
      f.status !== 'success' 
        ? { ...f, status: 'pending', progress: 0, errorMessage: undefined } 
        : f
    ));

    const maxThreads = settings.threadCount;
    let nextIndex = 0;
    
    const workerTask = async () => {
      while (nextIndex < pendingList.length) {
        const itemIndex = nextIndex++;
        const item = pendingList[itemIndex];
        
        // Update to processing
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 10 } : f));

        try {
          // 1. Read file bytes asynchronously
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(new Error('读取文件字节失败'));
            reader.readAsArrayBuffer(item.file);
          });

          const inputBytes = new Uint8Array(arrayBuffer);
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: 30 } : f));

          // 2. Parse NCM metadata
          const { keyBox, outputName, audioData, metadata } = parseNcmMetadata(inputBytes, item.name);
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: 50, metadata } : f));

          // 3. Perform RC4 decryption using Web Worker
          const decryptedBytes = await decryptWithWorker(audioData, keyBox);

          // 4. Trigger download immediately if autoSave is enabled (outside state updater to avoid double downloads in Strict Mode)
          if (settings.autoSave) {
            triggerDownload(decryptedBytes, outputName);
          }

          // 5. Update status in files list
          setFiles(prev => prev.map(f => {
            if (f.id === item.id) {
              return {
                ...f,
                status: 'success',
                progress: 100,
                outputName,
                outputBytes: settings.autoSave ? undefined : decryptedBytes,
                errorMessage: settings.autoSave ? '已下载且内存已释放' : undefined
              };
            }
            return f;
          }));

        } catch (err: any) {
          setFiles(prev => prev.map(f => f.id === item.id ? {
            ...f,
            status: 'failed',
            progress: 100,
            errorMessage: err.message || '格式解密失败'
          } : f));
        }
      }
    };

    // Spin up concurrent worker flows
    const activeWorkers = [];
    const runThreads = Math.min(maxThreads, pendingList.length);
    for (let i = 0; i < runThreads; i++) {
      activeWorkers.push(workerTask());
    }

    await Promise.all(activeWorkers);
    setIsProcessing(false);
  };

  // Stat computations
  const totalCount = files.length;
  const successCount = files.filter(f => f.status === 'success').length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const overallProgress = totalCount > 0 
    ? Math.round(((successCount + failedCount) / totalCount) * 100) 
    : 0;

  const hasSuccessfulBytes = files.some(f => f.status === 'success' && f.outputBytes);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start font-sans relative overflow-x-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-red-900/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none z-0" />

      {/* Header */}
      <header className="w-full max-w-5xl px-6 py-4 flex items-center justify-between border-b border-slate-900 z-10 backdrop-blur-md sticky top-0 bg-slate-950/70">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-500 rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              NCM Converter PWA
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              纯本地、多线程、超高速音频解密器
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            title={isDark ? "切换为明亮模式" : "切换为暗黑模式"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            title="高级设置"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsAboutOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            title="关于本软件"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl px-6 py-8 flex-1 flex flex-col gap-6 z-10">
        
        {/* Upload Dropzone */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
            dragActive 
              ? 'border-red-500 bg-red-950/15 scale-[0.99] shadow-inner' 
              : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/30'
          }`}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".ncm" 
            multiple 
            onChange={handleFileChange}
            className="hidden" 
          />
          <div className="p-4 bg-slate-900/50 rounded-2xl group-hover:scale-110 transition-transform duration-300 border border-slate-800/80 mb-4">
            <UploadCloud className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1 text-center">
            拖拽或点击上传 .ncm 格式音乐
          </h3>
          <p className="text-sm text-slate-500 text-center max-w-md">
            支持选择多个文件批量导入。解密算法在您本地的浏览器中执行，保证音频绝不传输至外部网络服务器。
          </p>
        </div>

        {/* Queue Overview and Process Controller */}
        {files.length > 0 && (
          <div className="glassmorphism rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-900">
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
                  解密转换进度: {overallProgress}%
                </span>
                <span className="text-xs text-slate-500">
                  成功: {successCount} | 失败: {failedCount} | 总数: {totalCount}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-950">
                <div 
                  className="bg-gradient-to-r from-red-500 to-rose-600 h-full rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={clearList}
                disabled={isProcessing}
                className="flex-1 md:flex-none py-3 px-5 border border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-900 hover:text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                清空列表
              </button>
              
              <button 
                onClick={startProcessing}
                disabled={isProcessing || successCount === totalCount}
                className="flex-2 md:flex-none py-3 px-8 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/15 disabled:opacity-50 disabled:hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在解密 ({processingCount} 并发)...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    开始解密 ({files.filter(f => f.status !== 'success').length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* File List Section */}
        {files.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                待处理列表
              </h2>
              {hasSuccessfulBytes && (
                <button 
                  onClick={handleDownloadAll}
                  className="text-xs text-red-500 hover:text-red-400 font-medium flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  批量下载全部已成功音频
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
              {files.map(item => {
                const isProcessingItem = item.status === 'processing';
                const isSuccessItem = item.status === 'success';
                const isFailedItem = item.status === 'failed';
                
                // Format artists if metadata exists
                const artistName = item.metadata?.artist 
                  ? item.metadata.artist.map(a => a[0]).join(', ')
                  : null;

                return (
                  <div 
                    key={item.id}
                    className="glassmorphism hover-glow rounded-xl p-4 flex items-center justify-between border border-slate-900/60 relative overflow-hidden transition-all duration-300"
                  >
                    
                    {/* Tiny item progress slider */}
                    {isProcessingItem && (
                      <div 
                        className="absolute bottom-0 left-0 bg-red-600/10 h-1 transition-all duration-300" 
                        style={{ width: `${item.progress}%` }}
                      />
                    )}

                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      
                      {/* Left Status Icon */}
                      <div className="flex-shrink-0">
                        {isProcessingItem && <Loader2 className="w-5 h-5 text-red-500 animate-spin" />}
                        {isSuccessItem && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {isFailedItem && <XCircle className="w-5 h-5 text-rose-500" />}
                        {item.status === 'pending' && <Music className="w-5 h-5 text-slate-600" />}
                      </div>

                      {/* File Names & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline space-x-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {item.metadata?.musicName || item.name.replace(/\.ncm$/i, '')}
                          </p>
                          <span className="text-[10px] text-slate-600 font-mono">
                            {(item.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {artistName ? `${artistName} • ` : ''}
                          {isSuccessItem && item.outputName 
                            ? `已输出: ${item.outputName}` 
                            : item.name
                          }
                        </p>

                        {/* Status Message / Error Message */}
                        {item.errorMessage && (
                          <p className={`text-[10px] mt-1 font-medium ${isSuccessItem ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                            {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right action button */}
                    <div className="ml-4 flex-shrink-0">
                      {isSuccessItem && item.outputBytes ? (
                        <button 
                          onClick={() => handleDownloadSingle(item)}
                          className="p-2 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-slate-900 transition-colors"
                          title="点击下载音频"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      ) : (
                        !isProcessing && (
                          <button 
                            onClick={() => removeFile(item.id)}
                            className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-slate-900 transition-colors"
                            title="从列表移除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 border border-dashed border-slate-900/60 rounded-2xl bg-slate-900/[0.04]">
            <Music className="w-12 h-12 stroke-[1.2] mb-3 text-slate-800" />
            <p className="text-sm">暂无待处理文件，导入后即可开始解密</p>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-6 px-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 z-10 gap-3">
        <p>© 2026 NCM Converter PWA. Powered by React + Web Worker.</p>
        <div className="flex items-center space-x-4">
          <a 
            href="https://github.com/mimai114514/ncmconverter" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-400 transition-colors flex items-center gap-1"
          >
            <Github className="w-4 h-4" />
            GitHub Repository
          </a>
        </div>
      </footer>

      {/* Settings Dialog Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-500" />
                高级设置参数
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors text-sm"
              >
                关闭
              </button>
            </div>

            <div className="space-y-6">
              
              {/* Thread count slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    最大并发 Web Worker 数 (线程数)
                  </label>
                  <span className="text-sm font-bold text-red-500 font-mono">
                    {settings.threadCount}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateSetting('threadCount', Math.max(1, settings.threadCount - 1))}
                    disabled={settings.threadCount <= 1}
                    className="p-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-30"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="16"
                    value={settings.threadCount}
                    onChange={(e) => updateSetting('threadCount', parseInt(e.target.value))}
                    className="flex-1 accent-red-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <button 
                    onClick={() => {
                      const next = settings.threadCount + 1;
                      if (next > 8 && !settings.ignoreMemoryWarning) {
                        if (confirm('⚠️ 高并发警告\n\n设置并发数大于 8 会显著增加设备内存与 CPU 开销。如果设备配置较低，可能导致浏览器崩溃。\n\n是否继续？')) {
                          updateSetting('ignoreMemoryWarning', true);
                          updateSetting('threadCount', next);
                        }
                      } else {
                        updateSetting('threadCount', Math.min(16, next));
                      }
                    }}
                    disabled={settings.threadCount >= 16}
                    className="p-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  并发解密线程数。数值越高越快，但也更消耗系统内存（推荐 4 - 8）。
                </p>
              </div>

              {/* AutoSave checkbox */}
              <div className="flex items-start justify-between border-t border-slate-800/80 pt-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block">
                    自动保存并释放内存
                  </label>
                  <span className="text-[11px] text-slate-500">
                    转换成功后立即下载文件并清理缓冲区。强烈推荐在大批量转换时开启。
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 mt-1">
                  <input 
                    type="checkbox" 
                    checked={settings.autoSave}
                    onChange={(e) => {
                      const active = e.target.checked;
                      if (!active && !settings.ignoreMemoryWarning) {
                        if (confirm('⚠️ 内存过载提醒\n\n关闭此选项后，所有解密后的文件将被缓存在浏览器内存中以供批量手动下载。\n\n转换大量文件（如整张专辑）可能耗尽浏览器运行内存导致崩溃。是否继续？')) {
                          updateSetting('ignoreMemoryWarning', true);
                          updateSetting('autoSave', false);
                        }
                      } else {
                        updateSetting('autoSave', active);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-500/25 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white peer-checked:after:border-white" />
                </label>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* About Dialog Overlay */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-red-500/10 rounded-full mb-4 border border-red-500/20 text-red-500">
              <Music className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-100 mb-1">
              NCM Converter PWA
            </h3>
            <p className="text-xs text-slate-500 font-mono mb-4">
              Version 1.0.0 (React Refactored)
            </p>

            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              本工具是一个基于网页端 PWA 的网易云音乐 .ncm 格式转换工具。<br />
              所有解密工作完全在您的浏览器本地沙箱中完成，极速安全，不占用服务器流量，让您的音乐解密隐私有绝对保障。
            </p>

            <div className="w-full border-t border-slate-800 pt-4 flex flex-col gap-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>核心算法</span>
                <span className="font-semibold text-slate-300">CryptoJS (AES-ECB 256)</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>多线程支持</span>
                <span className="font-semibold text-slate-300">Web Worker (Transferable Buffer)</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>技术框架</span>
                <span className="font-semibold text-slate-300">React + Vite + Tailwind CSS</span>
              </div>
            </div>

            <button 
              onClick={() => setIsAboutOpen(false)}
              className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
