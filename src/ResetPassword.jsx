import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we actually have an active session/recovery token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired reset link. Please try again.');
      }
    });
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      setMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    root: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a0c10', fontFamily: 'system-ui, sans-serif' },
    card: { width: 360, background: '#1a1d24', border: '1px solid #2a2d3a', borderRadius: 16, padding: '32px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 24 },
    title: { fontSize: 24, fontWeight: 600, color: '#e8eaf0', textAlign: 'center', margin: 0 },
    subtitle: { fontSize: 14, color: '#8b90a0', textAlign: 'center', marginTop: -16 },
    input: { width: '100%', padding: '12px 14px', background: '#12141a', border: '1px solid #2a2d3a', borderRadius: 8, color: '#e8eaf0', fontSize: 14, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
    button: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #4f8ef7, #7c6cf7)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1 },
    alert: { padding: '10px 12px', borderRadius: 6, fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' },
    success: { padding: '10px 12px', borderRadius: 6, fontSize: 13, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', fontSize: 48, marginBottom: -10 }}>🔑</div>
        <h2 style={s.title}>Set New Password</h2>
        <p style={s.subtitle}>Please enter your new password below</p>

        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={s.alert}>{error}</div>}
          {msg && <div style={s.success}>{msg}</div>}
          
          <input 
            type="password" 
            placeholder="New Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={s.input} 
            required 
          />
          
          <button type="submit" style={s.button} disabled={loading || msg}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
