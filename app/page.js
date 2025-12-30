'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to summarize');
      }

      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '650px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '24px',
        padding: '50px 40px',
        boxShadow: '0 25px 80px rgba(0,0,0,0.35)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            margin: '0 0 10px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎬 TL;DW
          </h1>
          <p style={{ 
            color: '#666', 
            fontSize: '1.1rem',
            margin: 0 
          }}>
            Too Long; Didn't Watch — Get YouTube summaries instantly!
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="🔗 Paste YouTube URL here..."
              style={{
                width: '100%',
                padding: '18px 22px',
                fontSize: '16px',
                border: '2px solid #e8e8e8',
                borderRadius: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              fontWeight: '600',
              color: 'white',
              background: loading || !url.trim() 
                ? '#ccc' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '14px',
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Summarizing... Please wait' : '✨ Summarize Video'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '25px',
            padding: '18px 22px',
            background: '#fff5f5',
            borderRadius: '14px',
            color: '#c53030',
            border: '1px solid #feb2b2'
          }}>
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {summary && (
          <div style={{
            marginTop: '25px',
            padding: '25px',
            background: '#f0fff4',
            borderRadius: '14px',
            border: '1px solid #9ae6b4'
          }}>
            <h3 style={{ 
              margin: '0 0 15px 0', 
              color: '#276749',
              fontSize: '1.3rem'
            }}>
              📝 Video Summary
            </h3>
            <div style={{ 
              color: '#2d3748', 
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap',
              fontSize: '15px'
            }}>
              {summary}
            </div>
          </div>
        )}

        <p style={{ 
          textAlign: 'center', 
          marginTop: '30px', 
          color: '#999',
          fontSize: '13px'
        }}>
          Powered by Hugging Face 🤗
        </p>
      </div>
    </main>
  );
}
