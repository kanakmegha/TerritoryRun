import { useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore';

const Login = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useGameStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await new Promise(r => setTimeout(r, 10)); // Yield to main thread to prevent UI lockup
    setLoading(true);
    setError('');
    try {
      const result = await login({ email, password });
      if (!result.success) {
          setError(result.message);
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2 className="cyber-glitch" data-text="ACCESS GRANTED">SYSTEM ACCESS</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
            <label>Email</label>
            <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                autoComplete="email"
            />
        </div>
        <div className="form-group">
            <label>Password</label>
            <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                autoComplete="current-password"
            />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className={`cyber-btn ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? 'ACCESSING...' : 'LOGIN'}
        </button>
      </form>
      <p className="switch-text">
        New Runner? <span onClick={onSwitch}>Initialize Protocol</span>
      </p>
      <style>{`
        .auth-container {
            background: rgba(10, 10, 10, 0.9);
            padding: 2rem;
            border: 1px solid var(--neon-blue);
            box-shadow: 0 0 20px rgba(0, 243, 255, 0.2);
            border-radius: 8px;
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        .form-group {
            margin-bottom: 1.5rem;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--neon-blue);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        input {
            width: 100%;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #333;
            border-bottom: 2px solid var(--neon-blue);
            color: white;
            font-family: inherit;
            outline: none;
            transition: all 0.3s;
        }
        input:focus {
            background: rgba(0, 243, 255, 0.1);
            border-color: var(--neon-pink);
        }
        .cyber-btn {
            background: transparent;
            color: var(--neon-blue);
            border: 1px solid var(--neon-blue);
            padding: 10px 20px;
            font-family: inherit;
            text-transform: uppercase;
            letter-spacing: 2px;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
            font-weight: bold;
        }
        .cyber-btn:hover {
            background: var(--neon-blue);
            color: black;
            box-shadow: 0 0 20px var(--neon-blue);
        }
        .switch-text {
            margin-top: 1.5rem;
            font-size: 0.9rem;
            color: #888;
        }
        .switch-text span {
            color: var(--neon-pink);
            cursor: pointer;
            text-decoration: underline;
        }
        .error-msg {
            color: #ff3333;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
};

export default Login;
