import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw } from 'lucide-react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [responseFilename, setResponseFilename] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format bytes to human readable sizes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Handle drag events
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  // Handle file select via clicking
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // File validation
  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    setUploadSuccess(false);

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }

    // Limit to 25MB for safety
    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 25MB limit.');
      return;
    }

    setFile(selectedFile);
  };

  // Reset file selection states
  const handleRemove = () => {
    setFile(null);
    setUploadSuccess(false);
    setErrorMessage(null);
    setResponseFilename(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload to backend
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setErrorMessage(null);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://127.0.0.1:8000/upload-pdf", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadSuccess(true);
      setResponseFilename(response.data.filename);
    } catch (err) {
      console.error("Upload error:", err);
      let message = "Unable to reach the backend API. Please make sure the backend server is running.";
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.detail || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="app-container">
      {/* Glow Effects in Background */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <svg viewBox="0 0 75 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon animate-pulse">
              <path d="M37.5 0L75 65H0L37.5 0Z" fill="currentColor"/>
            </svg>
          </div>
          <h1>DocuChat</h1>
        </div>
        <p className="subtitle">Transform your PDF documents into interactive conversational partners instantly.</p>
      </header>

      <main className="main-content">
        <div className="upload-card">
          <h2 className="card-title">Upload Document</h2>
          <p className="card-subtitle">Select or drop your PDF document below to start querying its contents.</p>

          {/* Error Banner */}
          {errorMessage && (
            <div className="alert alert-error">
              <AlertTriangle className="alert-icon" />
              <div className="alert-content">
                <span className="alert-message">{errorMessage}</span>
              </div>
              <button className="alert-close" onClick={() => setErrorMessage(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Success Banner */}
          {uploadSuccess && (
            <div className="alert alert-success">
              <CheckCircle2 className="alert-icon" />
              <div className="alert-content">
                <span className="alert-message">
                  Successfully uploaded <strong>{responseFilename || file?.name}</strong>! Ready for chatting.
                </span>
              </div>
              <button className="alert-close" onClick={handleRemove}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* File Picker / Dropzone */}
          {!file && (
            <div
              className={`dropzone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
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
                <span className="file-limit-text">PDF files only (Max 25MB)</span>
              </div>
            </div>
          )}

          {/* Selected File Details */}
          {file && !uploadSuccess && (
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
                  type="button"
                  className="remove-btn"
                  onClick={handleRemove}
                  disabled={uploading}
                  title="Remove file"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload Button Section */}
              <div className="action-section">
                <button
                  type="button"
                  className="upload-submit-btn"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="btn-icon animate-spin" />
                      Uploading Document...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="btn-icon" />
                      Upload & Process PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Reset Button */}
          {uploadSuccess && (
            <div className="success-action-section">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRemove}
              >
                <RefreshCw size={16} className="btn-icon" />
                Upload Another Document
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2026 DocuChat App. Powered by FastAPI, React & LangChain.</p>
      </footer>
    </div>
  );
}

export default App;
