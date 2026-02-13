const StatsCard = ({ label, value, icon: Icon }) => {
  return (
    <div className="stats-card">
      <div className="stats-icon">
        {Icon && <Icon size={24} color="var(--neon-blue)" />}
      </div>
      <div className="stats-info">
        <span className="stats-value">{value}</span>
        <span className="stats-label">{label}</span>
      </div>
      <style>{`
        .stats-card {
          background: rgba(20, 20, 20, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid var(--neon-blue);
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
          transition: transform 0.2s;
        }
        .stats-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.4);
        }
        .stats-value {
          display: block;
          font-size: 1.5rem;
          font-weight: bold;
          color: var(--text-main);
          text-shadow: 0 0 5px var(--neon-blue);
        }
        .stats-label {
          font-size: 0.8rem;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>
    </div>
  );
};

export default StatsCard;
