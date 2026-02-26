import React, { useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import Login from '../Auth/Login';
import Signup from '../Auth/Signup';

const LandingPage = () => {
    const { token } = useGameStore();
    const [isLogin, setIsLogin] = useState(true);

    if (token) {
        // Automatically redirect to Home if already logged in (optional depending on routing setup)
        return null;
    }

    return (
        <div className="landing-wrapper">
            <div className="cyber-overlay">
                <div className="branding">
                    <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
                    <p>VECTOR ACQUISITION PROTOCOL</p>
                </div>
                
                <div className="auth-box">
                    {isLogin ? 
                        <Login onSwitch={() => setIsLogin(false)} /> : 
                        <Signup onSwitch={() => setIsLogin(true)} />
                    }
                </div>
            </div>

            <style>{`
                .landing-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    background: #050505; /* Black fallback */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }
                .cyber-overlay {
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 40px;
                    background: rgba(0, 0, 0, 0.85);
                    padding: 40px;
                    border: 1px solid var(--neon-blue);
                    box-shadow: 0 0 30px rgba(0, 255, 234, 0.2);
                    backdrop-filter: blur(10px);
                }
                .branding {
                    text-align: center;
                }
                .branding p {
                    color: var(--neon-pink);
                    letter-spacing: 4px;
                    font-size: 0.9rem;
                    margin-top: -10px;
                }
                .auth-box {
                    width: 100%;
                    max-width: 400px;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
