import { useState, useRef, useEffect } from 'react';
import type { DragEvent, ChangeEvent, KeyboardEvent } from 'react';
import {
  UploadCloud, FileText, AlertTriangle,
  Loader2, X, Send, Bot, User, ArrowLeft,
  Clock, RefreshCw, Layers
} from 'lucide-react';
import axios from 'axios';
import './App.css';

const BASE = 'http://127.0.0.1:8000';

type Role = 'user' | 'assistant';
interface ChatMessage {
  role: Role;
  content: string;
}

interface PdfItem {
  id: number;
  file_name: string;
  created_at?: string;
}

/* ──────────────────────────────────────────────
   Home View (Left: PDF List, Right: Upload)
────────────────────────────────────────────── */
interface HomeViewProps {
  onSelectPdf: (id: number, name: string) => void;
}

function HomeView({ onSelectPdf }: HomeViewProps) {
  // Upload States
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF List States
  const [pdfList, setPdfList] = useState<PdfItem[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  const [pdfListError, setPdfListError] = useState<string | null>(null);

  const fetchPdfs = async () => {
    setLoadingPdfs(true);
    setPdfListError(null);
    try {
      const res = await axios.get(`${BASE}/pdfs`);
      setPdfList(res.data.data.pdfs || []);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setPdfListError(err.response?.data?.message ?? err.message);
      } else {
        setPdfListError('Failed to fetch documents');
      }
    } finally {
      setLoadingPdfs(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const validate = (f: File) => {
    setUploadError(null);
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are allowed.');
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds 25 MB limit.');
      return;
    }
    setFile(f);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validate(e.dataTransfer.files[0]);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validate(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await axios.post(`${BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { id, filename } = res.data.data;
      // Instantly open the chat with newly uploaded PDF
      onSelectPdf(id, filename);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setUploadError(err.response?.data?.message ?? err.message);
      } else {
        setUploadError('Upload failed. Is the backend running?');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <svg viewBox="0 0 75 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon animate-pulse">
              <path d="M37.5 0L75 65H0L37.5 0Z" fill="currentColor" />
            </svg>
          </div>
          <h1>DocuChat</h1>
        </div>
        <p className="subtitle">Transform your PDF documents into interactive conversational partners instantly.</p>
      </header>

      {/* 2-Column Dashboard */}
      <main className="dashboard-grid">
        {/* Left Column: PDF Documents List */}
        <section className="documents-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Layers size={18} className="panel-title-icon" />
              <h2 className="panel-title">Your Documents</h2>
              <span className="count-badge">{pdfList.length}</span>
            </div>
            <button
              className="refresh-btn"
              onClick={fetchPdfs}
              disabled={loadingPdfs}
              title="Refresh documents list"
            >
              <RefreshCw size={14} className={loadingPdfs ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="documents-content">
            {pdfListError && (
              <div className="panel-alert error">
                <AlertTriangle size={14} />
                <span>{pdfListError}</span>
              </div>
            )}

            {loadingPdfs && (
              <div className="loading-state">
                <Loader2 size={24} className="animate-spin text-muted" />
                <span>Loading documents…</span>
              </div>
            )}

            {!loadingPdfs && pdfList.length === 0 && (
              <div className="empty-panel">
                <FileText size={36} className="empty-panel-icon" />
                <p className="empty-panel-title">No PDFs uploaded yet</p>
                <p className="empty-panel-subtitle">Upload a PDF on the right to start querying.</p>
              </div>
            )}

            {!loadingPdfs && pdfList.length > 0 && (
              <div className="pdf-items-list">
                {pdfList.map((item) => (
                  <div
                    key={item.id}
                    className="pdf-item-card"
                    onClick={() => onSelectPdf(item.id, item.file_name)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="pdf-item-icon-box">
                      <FileText size={18} />
                    </div>
                    <div className="pdf-item-details">
                      <span className="pdf-item-name" title={item.file_name}>
                        {item.file_name}
                      </span>
                      <div className="pdf-item-meta">
                        <span className="pdf-id-tag">ID #{item.id}</span>
                        {item.created_at && (
                          <span className="pdf-time-tag">
                            <Clock size={11} />
                            {formatDate(item.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pdf-item-arrow">
                      <span>Chat →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Upload Area */}
        <section className="upload-panel">
          <div className="upload-card">
            <h2 className="card-title">Upload a PDF</h2>
            <p className="card-subtitle">Select or drop a new document to index and start chatting.</p>

            {uploadError && (
              <div className="alert alert-error">
                <AlertTriangle className="alert-icon" />
                <span className="alert-message">{uploadError}</span>
                <button className="alert-close" onClick={() => setUploadError(null)}>
                  <X size={16} />
                </button>
              </div>
            )}

            {!file ? (
              <div
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="file-input-hidden"
                  accept=".pdf"
                  onChange={handleChange}
                />
                <div className="dropzone-content">
                  <div className="upload-icon-wrapper">
                    <UploadCloud className="upload-icon" />
                  </div>
                  <div className="dropzone-text">
                    <span className="highlight-text">Click to upload</span> or drag and drop
                  </div>
                  <span className="file-limit-text">PDF files only · Max 25 MB</span>
                </div>
              </div>
            ) : (
              <div className="file-details-card">
                <div className="file-info">
                  <div className="file-icon-wrapper">
                    <FileText className="pdf-icon" />
                  </div>
                  <div className="file-meta">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{formatBytes(file.size)}</span>
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                    title="Remove file"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="action-section">
                  <button
                    className="upload-submit-btn"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="btn-icon animate-spin" />
                        Processing &amp; Indexing…
                      </>
                    ) : (
                      <>
                        <UploadCloud className="btn-icon" />
                        Upload &amp; Index PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 DocuChat · Powered by FastAPI, LangChain &amp; Ollama</p>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Chat View
────────────────────────────────────────────── */
interface ChatViewProps {
  pdfId: number;
  pdfName: string;
  onBack: () => void;
}

function ChatView({ pdfId, pdfName, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load previous history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${BASE}/chat/${pdfId}`);
        const history: ChatMessage[] = res.data.data.messages.map(
          (m: { role: Role; content: string }) => ({ role: m.role, content: m.content })
        );
        setMessages(history);
      } catch {
        // No history or network error — start fresh
      } finally {
        setHistoryLoaded(true);
      }
    };
    loadHistory();
  }, [pdfId]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const q = query.trim();
    if (!q || loading) return;

    setQuery('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await axios.post(
        `${BASE}/chat?id=${pdfId}`,
        JSON.stringify(q),
        { headers: { 'Content-Type': 'application/json' } }
      );
      const answer: string = res.data.data.answer;
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message);
      } else {
        setError('Request failed. Is the backend running?');
      }
      // Remove the optimistic user message on failure
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-view">
      {/* Top bar */}
      <header className="chat-header">
        <button className="back-btn" onClick={onBack} title="Back to documents & upload">
          <ArrowLeft size={18} />
          <span className="back-label">All Documents</span>
        </button>
        <div className="chat-header-info">
          <FileText size={16} className="chat-header-icon" />
          <span className="chat-header-name" title={pdfName}>{pdfName}</span>
        </div>
        <div className="chat-header-badge">ID #{pdfId}</div>
      </header>

      {/* Messages */}
      <div className="messages-area">
        {historyLoaded && messages.length === 0 && !loading && (
          <div className="empty-state">
            <Bot size={36} className="empty-icon" />
            <p className="empty-title">Ask me anything about this PDF</p>
            <p className="empty-subtitle">I'll search through the document chunks and answer based on its content.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="message-bubble">
              <p className="message-text">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="message-avatar"><Bot size={14} /></div>
            <div className="message-bubble thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="chat-error-bar">
          <AlertTriangle size={14} />
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        <textarea
          id="chat-input"
          className="chat-input"
          placeholder="Ask a question about the PDF… (Press Enter to send)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          id="send-btn"
          className="send-btn"
          onClick={sendMessage}
          disabled={!query.trim() || loading}
          title="Send (Enter)"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Root App
────────────────────────────────────────────── */
export default function App() {
  const [selectedPdf, setSelectedPdf] = useState<{ id: number; name: string } | null>(null);

  if (selectedPdf !== null) {
    return (
      <ChatView
        pdfId={selectedPdf.id}
        pdfName={selectedPdf.name}
        onBack={() => setSelectedPdf(null)}
      />
    );
  }

  return (
    <HomeView
      onSelectPdf={(id, name) => setSelectedPdf({ id, name })}
    />
  );
}
