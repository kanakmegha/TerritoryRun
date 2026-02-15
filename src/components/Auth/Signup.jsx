import { useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore';

const Signup = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
      color: '#00f3ff'
  });
  const [error, setError] = useState('');
  const { signup } = useGameStore();

  const handleChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await signup(formData);
      if (!result.success) {
          setError(result.message);
      }
    } catch (err) {
      setError('Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <h2 className="cyber-glitch" data-text="NEW IDENTITY">NEW IDENTITY</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
            <label>Codename (Username)</label>
            <input 
                name="username" 
                value={formData.username} 
                onChange={handleChange} 
                required 
                autoComplete="username"
            />
        </div>
        <div className="form-group">
            <label>Email</label>
            <input 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                autoComplete="email"
            />
        </div>
        <div className="form-group">
            <label>Password</label>
            <input 
                name="password" 
                type="password" 
                value={formData.password} 
                onChange={handleChange} 
                required 
                autoComplete="new-password"
            />
        </div>
        <div className="form-group">
            <label>Neon Signature (Color)</label>
            <input 
                name="color" 
                type="color" 
                value={formData.color} 
                onChange={handleChange} 
                className="color-picker"
            />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="cyber-btn">INITIALIZE</button>
      </form>
      <p className="switch-text">
        Already an agent? <span onClick={onSwitch}>Access System</span>
      </p>
      <style>{`
        .color-picker {
            padding: 0;
            height: 40px;
            cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default Signup;
