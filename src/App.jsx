import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  Play, 
  Settings, 
  FileCode, 
  Folder, 
  ChevronRight, 
  Send, 
  Sparkles,
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState(['System: Ready to build. Please set your API Key first.']);
  const [activeTab, setActiveTab] = useState('preview'); // preview | terminal
  const [files, setFiles] = useState({
    'index.html': '<h1>Hello from BoltMatrix!</h1>\n<p>Start prompting on the left to generate amazing UIs live.</p>',
    'styles.css': 'body { background: #18181b; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; } h1 { color: #007acc; }',
    'app.js': 'console.log("App loaded successfully!");'
  });
  const [activeFile, setActiveFile] = useState('index.html');
  const [editorContent, setEditorContent] = useState(files['index.html']);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const webcontainerRef = useRef(null);

  useEffect(() => {
    // Dynamic import to support SSR environments safely
    import('@webcontainer/api').then(({ WebContainer }) => {
      WebContainer.boot().then(instance => {
        webcontainerRef.current = instance;
        addLog('WebContainer: Engine booted successfully in-browser!');
        mountFiles(files);
      });
    }).catch(err => {
      addLog('WebContainer Error: ' + err.message);
    });
  }, []);

  const addLog = (text) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  const mountFiles = async (fileSystem) => {
    if (!webcontainerRef.current) return;
    
    addLog('System: Mounting files to sandbox...');
    const filesToMount = {};
    Object.keys(fileSystem).forEach(filename => {
      filesToMount[filename] = {
        file: {
          contents: fileSystem[filename]
        }
      };
    });

    // Simple dev-server configuration
    filesToMount['package.json'] = {
      file: {
        contents: JSON.stringify({
          name: "sandbox-app",
          type: "module",
          dependencies: {
            "serve": "^14.2.1"
          },
          scripts: {
            "start": "serve -p 3000"
          }
        }, null, 2)
      }
    };

    await webcontainerRef.current.mount(filesToMount);
    addLog('System: Files mounted! Installing dev-server...');
    
    // Install dependencies
    const installProcess = await webcontainerRef.current.spawn('npm', ['install']);
    installProcess.output.pipeTo(new WritableStream({
      write(data) { addLog(`[npm] ${data}`); }
    }));
    
    const code = await installProcess.exit;
    if (code === 0) {
      addLog('System: Packages installed! Starting server...');
      startServer();
    } else {
      addLog('System: Package installation failed.');
    }
  };

  const startServer = async () => {
    if (!webcontainerRef.current) return;
    
    const startProcess = await webcontainerRef.current.spawn('npm', ['start']);
    startProcess.output.pipeTo(new WritableStream({
      write(data) { addLog(`[server] ${data}`); }
    }));

    webcontainerRef.current.on('server-ready', (port, url) => {
      addLog(`System: Sandbox server is ready at ${url}`);
      setPreviewUrl(url);
    });
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setShowSettings(false);
    addLog('System: API Key configured and saved.');
  };

  const selectFile = (filename) => {
    // Save current active file content first
    setFiles(prev => ({ ...prev, [activeFile]: editorContent }));
    setActiveFile(filename);
    setEditorContent(files[filename] || '');
  };

  const runAiCodeGeneration = async () => {
    if (!prompt) return;
    if (!apiKey) {
      addLog('Error: Please enter an API key in the top settings panel.');
      setShowSettings(true);
      return;
    }

    setIsProcessing(true);
    addLog(`AI: Analyzing prompt "${prompt}"...`);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: "json_object" },
          messages: [
            {
              role: 'system',
              content: `You are an AI code developer. You output complete HTML, CSS, and JS web application files based on user prompts.\nReturn ONLY a JSON object containing the files 'index.html', 'styles.css', and 'app.js'.\nExample Structure:\n{\n  "index.html": "code here",\n  "styles.css": "code here",\n  "app.js": "code here"\n}`
            },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const generatedFiles = JSON.parse(data.choices[0].message.content);
      
      setFiles(generatedFiles);
      setEditorContent(generatedFiles[activeFile] || generatedFiles['index.html']);
      addLog('AI: Code successfully generated! Re-mounting sandbox...');
      
      await mountFiles(generatedFiles);
    } catch (err) {
      addLog('AI Error: ' + err.message);
    } finally {
      setIsProcessing(false);
      setPrompt('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <Sparkles size={18} />
          </div>
          <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            BOLT MATRIX
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">v0.1.0</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Settings size={18} /> API Configuration
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Enter your OpenAI API key. Keys are saved securely in your browser's local storage.
            </p>
            <input 
              type="password" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 hover:bg-zinc-800 rounded-lg text-sm text-zinc-400"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel: Chat & Prompter */}
        <section className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col justify-between">
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles size={14} className="text-blue-500" /> AI Web Developer
            </div>
            
            <div className="bg-zinc-900 p-4 border border-zinc-800 rounded-xl mb-4 text-sm leading-relaxed text-zinc-300">
              أهلاً بك فـ <span className="text-blue-400 font-semibold">BoltMatrix</span>! 🚀
              اكتب شنو السيت اللي باغي تصاوب ف التحت، والـ AI غايكوديه ويخدمو ليك ف الـ Sandbox ديريكت قدام عينيك.
            </div>

            <div className="space-y-3">
              <div className="text-xs text-zinc-500">Suggestions:</div>
              {['Interactive Dashboard', 'Dark Weather App', 'Pomodoro Timer'].map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(`Build a beautiful, responsive ${sug} with dark UI, engaging animations, and clean design.`)}
                  className="w-full text-left p-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 rounded-lg text-sm text-zinc-300 transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            <div className="relative">
              <textarea 
                rows="3"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What do you want to build today?..."
                className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 resize-none pr-12 placeholder:text-zinc-600"
              />
              <button 
                onClick={runAiCodeGeneration}
                disabled={isProcessing}
                className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 rounded-lg text-white transition-colors"
              >
                {isProcessing ? (
                  <RefreshCw size={18} className="animate-spin text-zinc-500" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Center Panel: File Tree & Code Editor */}
        <section className="flex-1 flex flex-col border-r border-zinc-800 bg-zinc-950">
          {/* File Tab Selector */}
          <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/40 border-b border-zinc-800 overflow-x-auto">
            {Object.keys(files).map((filename) => (
              <button 
                key={filename}
                onClick={() => selectFile(filename)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${
                  activeFile === filename 
                    ? 'bg-zinc-800 text-blue-400 border border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FileCode size={14} />
                {filename}
              </button>
            ))}
          </div>

          {/* Code Editor (Sleek Monospace textarea) */}
          <div className="flex-1 p-4 relative">
            <textarea 
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full h-full bg-transparent font-mono text-sm leading-relaxed text-zinc-300 focus:outline-none resize-none"
              spellCheck="false"
            />
          </div>
        </section>

        {/* Right Panel: Sandbox Live Preview & Terminal */}
        <section className="w-[500px] flex flex-col bg-zinc-900/30">
          {/* Tabs header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeTab === 'preview' ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Eye size={14} /> Live Preview
              </button>
              <button 
                onClick={() => setActiveTab('terminal')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeTab === 'terminal' ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <TerminalIcon size={14} /> Terminal Logs
              </button>
            </div>

            {previewUrl && (
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Tab Contents */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab === 'preview' ? (
              <div className="flex-1 bg-zinc-950 p-2 flex items-center justify-center">
                {previewUrl ? (
                  <iframe 
                    src={previewUrl} 
                    title="Live Sandbox Preview"
                    className="w-full h-full rounded-lg border border-zinc-800 bg-white"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-600 text-sm">
                    <RefreshCw size={24} className="animate-spin text-zinc-700" />
                    Booting sandbox server...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 bg-zinc-950 p-4 font-mono text-xs text-zinc-400 overflow-y-auto leading-relaxed">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1.5 text-zinc-500 hover:text-zinc-300 select-all font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}