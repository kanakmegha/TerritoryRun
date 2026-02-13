import { useState } from 'react';
import axios from 'axios';
import { useGameStore } from '../../hooks/useGameStore';

const Signup = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
      color: '#00f3ff'
  });
  const [error, setError] = useState('');
  const { login } = useGameStore();

  const handleChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await axios.post('/api/auth/register', formData);
      login(res.data.token, res.data.user);
    } catch (err) {
      console.error("Full Registration Error:", err);
      console.log("Error Response Data:", err.response?.data);
      console.log("Error Response Status:", err.response?.status);
      
      if (err.response?.status === 403) {
          // If the server sent a specific message, show it. Otherwise show generic IP warning.
          setError(err.response?.data?.message || "Access Denied: Please check your MongoDB IP Whitelist (Network Access).");
      } else {
          setError(err.response?.data?.message || 'Registration failed');
      }
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
