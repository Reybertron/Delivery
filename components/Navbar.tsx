
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/database';
import { AppConfig } from '../types';

const Navbar: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    db.getConfig().then(setConfig).catch(() => {});
  }, []);

  if (!config) return <nav className="h-16 bg-orange-600 animate-pulse"></nav>;

  return (
    <nav className="bg-orange-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3 group">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-sm" />
            ) : (
              <div className="bg-white/20 p-2 rounded-full w-10 h-10 flex items-center justify-center">
                <i className="fas fa-utensils text-xl"></i>
              </div>
            )}
            <span className="font-bold text-lg md:text-xl tracking-tight uppercase truncate max-w-[150px] md:max-w-none">
              {config.businessName}
            </span>
          </Link>
          <div className="flex space-x-4 md:space-x-6 items-center">
            <Link to="/" className="hover:text-orange-200 transition-colors font-bold text-xs uppercase tracking-widest">Cardápio</Link>
            
            {/* 
                LOGICA SENIOR: 
                hidden -> Esconde por padrão (mobile)
                md:block -> Mostra a partir de telas médias (Desktop/Tablet)
            */}
            <Link 
              to="/admin" 
              className="hidden md:block bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-[0.2em] border border-white/10"
            >
              Painel ADM
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
