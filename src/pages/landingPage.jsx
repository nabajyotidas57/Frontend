import "./landingPage.css";
import { UserCircle, Shield, Lock, Users, ArrowRight } from "lucide-react";
import hdfcLogo from '../assets/hdfcbanklogo.png';
const API_BASE = "http://localhost:8000";

function LandingPage() {
  const handleLogin = () => {
    window.location.href = `${API_BASE}/login`;
  };

  const features = [
    { icon: <Shield size={22} />, title: "Secure Access" },
    { icon: <Lock size={22} />, title: "Role-Based Control" },
    { icon: <Users size={22} />, title: "Multi-User Support" }
  ];

  return (
    <div className="landing-container">
      
      {/* Header */}
      <header className="landing-header">
        <div className="logo-box">
          <img src={hdfcLogo} alt="HDFC Bank Logo" className="logo-img" />
          <span className="logo-title"></span>
        </div> {/* <--- This closes the logo-box correctly */}

        {/* REMOVE THE EXTRA </div> HERE */}
        
        <nav className="header-nav">
          <button className="login-btn" onClick={handleLogin}>
            <span>Log In</span>
            <UserCircle size={18} />
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <div className="landing-wrapper">
        
        {/* LEFT */}
        <div className="landing-left">
          <h1 className="landing-title">
            Welcome to <span className="gradient-text">Auth Service</span>
          </h1>

          <p className="subtitle-line1">
            Secure Identity & Access Management
          </p>

          <button className="get-started-btn" onClick={handleLogin}>
            <span>Get Started</span>
            <ArrowRight size={18} />
          </button>

          {/* Features */}
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="landing-right">
          <div className="illustration-wrapper">
            <img
              src="/src/assets/yy.png"
              alt="Security Illustration"
              className="main-illustration"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
