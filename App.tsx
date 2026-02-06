
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Admin from './pages/Admin';
import DelivererLogin from './pages/DelivererLogin';
import DelivererDashboard from './pages/DelivererDashboard';
import PaymentSuccess from './pages/PaymentSuccess';
import { isNative } from './lib/platform';
import { db } from './services/database';
import { AppConfig } from './types';
import { useState, useEffect } from 'react';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    db.getConfig().then(setConfig).catch(() => { });
  }, []);

  const currentYear = new Date().getFullYear();
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-stone-50 pb-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/success" element={<PaymentSuccess />} />
            <Route path="/delivery/login" element={<DelivererLogin />} />
            <Route path="/delivery/dashboard" element={<DelivererDashboard />} />
            {!isNative && <Route path="/admin" element={<Admin />} />}
            {/* Se tentar acessar /admin no mobile, volta para a Home */}
            {isNative && <Route path="/admin" element={<Home />} />}
          </Routes>
        </main>

        <footer className="bg-stone-900 text-stone-400 py-10">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex justify-center space-x-6 mb-6">
              {config?.instagramUrl && (
                <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  <i className="fab fa-instagram text-2xl"></i>
                </a>
              )}
              {config?.businessWhatsApp && (
                <a href={`https://wa.me/55${config.businessWhatsApp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  <i className="fab fa-whatsapp text-2xl"></i>
                </a>
              )}
              {config?.facebookUrl && (
                <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  <i className="fab fa-facebook text-2xl"></i>
                </a>
              )}
            </div>
            <p className="text-sm">© {currentYear} {config?.businessName || 'Panelas da Vanda'} - Todos os direitos reservados. by Reyges Lima</p>
            <p className="text-[10px] mt-2 text-stone-600 uppercase tracking-widest font-bold">Comida Caseira • Qualidade • Delivery</p>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
