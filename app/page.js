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
        {/* Header */}
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

        {/* Form */}
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
                transition: 'border-color 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e8e8e8'}
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
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: loading || !url.trim() 
                ? 'none' 
                : '0 4px 15px rgba(102, 126, 234, 0.4)'
            }}
            onMouseOver={(e) => {
              if (!loading && url.trim()) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
          >
            {loading ? '⏳ Summarizing... Please wait' : '✨ Summarize Video'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div style={{
            marginTop: '25px',
            padding: '18px 22px',
            background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
            borderRadius: '14px',
            color: '#c53030',
            border: '1px solid #feb2b2'
          }}>
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {/* Summary Result */}
        {summary && (
          <div style={{
            marginTop: '25px',
            padding: '25px',
            background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)',
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

        {/* Footer */}
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
