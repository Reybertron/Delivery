
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Admin from './pages/Admin';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-stone-50 pb-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        
        <footer className="bg-stone-900 text-stone-400 py-10">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex justify-center space-x-6 mb-6">
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-instagram text-2xl"></i></a>
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-whatsapp text-2xl"></i></a>
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-facebook text-2xl"></i></a>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} Panelas da Vanda - Todos os direitos reservados.</p>
            <p className="text-[10px] mt-2 text-stone-600 uppercase tracking-widest font-bold">Comida Caseira • Qualidade • Delivery</p>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
