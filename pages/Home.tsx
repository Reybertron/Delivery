
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Marmita, DayOfWeek, OrderItem, Order, Neighborhood, DeliveryMethod, Opcional, AppConfig } from '../types';
import { generateWhatsAppLink } from '../services/whatsapp';
import { db } from '../services/database';

// Componentes Refatorados
import MenuSection from '../components/home/MenuSection';
import CartSection from '../components/home/CartSection';
import OrderTrackingModal from '../components/home/OrderTrackingModal';
import OptionalsModal from '../components/home/OptionalsModal';

const Home: React.FC = () => {
  const [menu, setMenu] = useState<Marmita[]>([]);
  const [bairros, setBairros] = useState<Neighborhood[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [searchPhone, setSearchPhone] = useState(localStorage.getItem('last_track_phone') || '');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('Entrega');

  const [optionalModal, setOptionalModal] = useState<{
    show: boolean;
    marmita: Marmita | null;
    selections: { [groupId: string]: Opcional[] };
  }>({ show: false, marmita: null, selections: {} });

  const [customerInfo, setCustomerInfo] = useState({
    phone: '',
    name: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    payment: 'Pix' as const,
    observations: ''
  });

  const phoneInputRef = useRef<HTMLInputElement>(null);

  const isBusinessOpen = useMemo(() => {
    if (!config || !config.openingTime || !config.closingTime) return true;
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTimeStr >= config.openingTime && currentTimeStr <= config.closingTime;
  }, [config]);

  const todayDay = useMemo(() => {
    const daysMap = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
    ];
    return daysMap[new Date().getDay()];
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') === 'true') {
      setIsTestMode(true);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [menuData, bairrosData, configData] = await Promise.all([
          db.getMenu(),
          db.getBairros(),
          db.getConfig()
        ]);
        setMenu(menuData);
        setBairros(bairrosData);
        setConfig(configData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const fetchCustomer = async () => {
      const cleanPhone = customerInfo.phone.replace(/\D/g, '');
      // No Brasil, telefones fixos tem 10 dígitos e celulares 11.
      if (cleanPhone.length >= 10) {
        try {
          const existingCustomer = await db.getCustomer(cleanPhone);
          if (existingCustomer) {
            const bairroSalvo = existingCustomer.neighborhood || '';
            const bairroValido = bairros.find(b =>
              b.name.toLowerCase().trim() === bairroSalvo.toLowerCase().trim()
            );

            setCustomerInfo(prev => {
              // Só preenchemos se o telefone ainda for o mesmo que buscamos
              if (prev.phone.replace(/\D/g, '') !== cleanPhone) return prev;

              return {
                ...prev,
                name: existingCustomer.name || prev.name,
                cep: existingCustomer.cep || prev.cep,
                street: existingCustomer.street || prev.street,
                number: existingCustomer.number || prev.number,
                complement: existingCustomer.complement || prev.complement,
                neighborhood: bairroValido ? bairroValido.name : prev.neighborhood
              };
            });
          }
        } catch (e) {
          console.debug("Busca de cliente falhou", e);
        }
      }
    };
    const timer = setTimeout(fetchCustomer, 600);
    return () => clearTimeout(timer);
  }, [customerInfo.phone, bairros]);

  const handleCEPLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setCustomerInfo(prev => ({ ...prev, cep: cleanCep }));
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCustomerInfo(prev => ({ ...prev, street: data.logradouro, neighborhood: data.bairro }));
        }
      } catch (e) {
        console.error("Erro ao buscar CEP");
      }
    }
  };

  const selectedNeighborhoodFee = useMemo(() => {
    if (deliveryMethod === 'Retirada') return 0;
    const b = bairros.find(n => n.name.toLowerCase() === customerInfo.neighborhood.toLowerCase());
    return b ? b.deliveryFee : 0;
  }, [customerInfo.neighborhood, bairros, deliveryMethod]);

  const filteredMenu = useMemo(() => menu.filter(m => m.day === todayDay && m.available), [menu, todayDay]);

  const addToCart = (marmita: Marmita, selectedOptionals?: Opcional[]) => {
    if (!isBusinessOpen) return;
    if (marmita.gruposOpcionais && marmita.gruposOpcionais.length > 0 && !selectedOptionals) {
      setOptionalModal({ show: true, marmita, selections: {} });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => {
        const sameMarmita = item.marmita.id === marmita.id;
        if (!sameMarmita) return false;
        const optA = item.selectedOptionals || [];
        const optB = selectedOptionals || [];
        if (optA.length !== optB.length) return false;
        return optA.every(oa => optB.some(ob => ob.id === oa.id));
      });

      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { marmita, quantity: 1, selectedOptionals }];
    });

    if (!selectedOptionals) {
      setTimeout(() => {
        phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneInputRef.current?.focus();
      }, 100);
    }
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.marmita.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const optionalsPrice = (item.selectedOptionals || []).reduce((sum, opt) => sum + opt.precoAdicional, 0);
      return acc + ((item.marmita.price + optionalsPrice) * item.quantity);
    }, 0);
  }, [cart]);
  const total = subtotal + selectedNeighborhoodFee;

  const handleCheckout = async () => {
    if (!isBusinessOpen) return;
    const { phone, name, street, number, neighborhood, payment, cep, complement, observations } = customerInfo;

    if (!phone || !name || cart.length === 0) return alert('Por favor, preencha seu Nome, WhatsApp e escolha os itens!');
    if (deliveryMethod === 'Entrega' && (!street || !number || !neighborhood)) return alert('Para entrega, precisamos do endereço completo e bairro!');

    setIsProcessing(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      await db.saveCustomer({
        phone: cleanPhone,
        name,
        cep,
        street: deliveryMethod === 'Retirada' ? '' : street,
        number: deliveryMethod === 'Retirada' ? '' : number,
        complement: deliveryMethod === 'Retirada' ? '' : complement,
        neighborhood: deliveryMethod === 'Retirada' ? 'Retirada' : neighborhood
      });

      const order: Order = {
        id: `PED-${Date.now()}`,
        customerPhone: cleanPhone,
        customerName: name,
        customerAddress: deliveryMethod === 'Retirada' ? 'RETIRADA NO LOCAL' : `${street}, ${number} ${complement}`,
        neighborhood: deliveryMethod === 'Retirada' ? 'Retirada' : neighborhood,
        deliveryMethod,
        deliveryFee: selectedNeighborhoodFee,
        paymentMethod: payment,
        items: cart,
        subtotal,
        total,
        status: isTestMode ? 'Cancelado' : 'Pendente', // Marca como cancelado/teste para não poluir
        observations: isTestMode ? `[TESTE] ${observations}` : observations,
        createdAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString()
      };

      await db.saveOrder(order);
      localStorage.setItem('last_track_phone', cleanPhone);
      setSearchPhone(cleanPhone);
      handleTrackOrder(cleanPhone);

      // --- INTEGRAÇÃO MERCADO PAGO ---
      if (['Pix', 'Cartão'].includes(payment) && config?.mercadoPagoEnabled) {
        try {
          const res = await db.checkoutMercadoPago({
            orderItems: cart,
            total,
            deliveryFee: selectedNeighborhoodFee,
            customerInfo: { ...customerInfo, phone: cleanPhone }
          });

          const paymentUrl = isTestMode ? (res.sandbox_point || res.init_point) : res.init_point;

          if (paymentUrl) {
            window.location.href = paymentUrl;
            return;
          }
        } catch (mpError: any) {
          console.error("ERRO DETALHADO MP:", mpError);
          let errorMsg = mpError.message;
          alert(`Erro Mercado Pago: ${errorMsg}\n\nO pedido foi registrado localmente.`);
        }
      }

      setCart([]);
      setCustomerInfo({ phone: '', name: '', cep: '', street: '', number: '', complement: '', neighborhood: '', payment: 'Pix', observations: '' });
      setDeliveryMethod('Entrega');

      if (isTestMode) {
        alert("✅ PEDIDO DE TESTE REALIZADO! Em produção, o WhatsApp seria aberto agora.");
        return;
      }

      if (config) window.open(generateWhatsAppLink(order, config), '_blank');
    } catch (e: any) {
      alert("Erro ao processar: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrackOrder = async (phoneToSearch?: string) => {
    const phone = (phoneToSearch || searchPhone).replace(/\D/g, '');
    if (!phone) return;
    setIsSearchingOrder(true);
    try {
      const order = await db.getLatestOrder(phone);
      if (order) {
        setTrackedOrder(order);
        localStorage.setItem('last_track_phone', phone);
        setShowStatusModal(true);
      } else {
        alert("Nenhum pedido encontrado para este número.");
      }
    } catch (e) {
      alert("Erro ao buscar pedido.");
    } finally {
      setIsSearchingOrder(false);
    }
  };

  if (error) return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-red-50 border border-red-200 rounded-3xl text-center">
      <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
      <h2 className="text-xl font-bold text-red-700">Ops! Erro de Conexão</h2>
      <p className="text-sm text-red-600 mt-2">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Tentar Novamente</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* OVERLAY DE FORA DE HORARIO */}
      {!isBusinessOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/95 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-red-500"></div>
            <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-red-500">
              <i className="fas fa-moon text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-stone-900 uppercase tracking-tighter leading-none mb-4">Cozinha Descansando!</h2>
            <p className="text-stone-500 font-medium text-sm leading-relaxed mb-10">
              Estamos fechados no momento. Nosso horário de atendimento é das <span className="text-orange-600 font-black">{config?.openingTime}</span> às <span className="text-orange-600 font-black">{config?.closingTime}</span>.
            </p>
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 flex items-center justify-between mb-8">
              <span className="text-[10px] font-black uppercase text-stone-400">Status Atual</span>
              <span className="text-red-600 font-black text-xs uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                FECHADO
              </span>
            </div>
            <p className="text-[10px] text-stone-300 font-black uppercase tracking-[0.2em] mb-8">Agradecemos a compreensão</p>
            <Link to="/admin" className="inline-flex items-center gap-2 px-8 py-3 bg-stone-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-600 hover:bg-stone-200 transition-all border border-stone-200/50">
              <i className="fas fa-lock text-[8px]"></i>
              Acesso Administrativo
            </Link>
          </div>
        </div>
      )}

      {/* Botão Flutuante de Rastreio */}
      <button
        onClick={() => setShowStatusModal(true)}
        className="fixed bottom-6 left-6 z-50 bg-stone-900 text-white px-6 py-4 rounded-full shadow-2xl font-black text-xs uppercase flex items-center gap-3 hover:bg-orange-600 transition-all transform hover:-translate-y-1"
      >
        <i className="fas fa-search-location text-lg text-orange-500"></i>
        Acompanhar meu Pedido
      </button>

      {/* Banner de Boas Vindas */}
      <div className="bg-orange-600 text-white p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between items-center shadow-xl relative overflow-hidden">
        {isTestMode && (
          <div className="absolute inset-0 bg-yellow-400 z-50 flex items-center justify-center bg-opacity-95">
            <div className="text-center">
              <p className="text-orange-900 font-black text-2xl uppercase italic animate-pulse">🛠️ MODO DE TESTE ATIVO</p>
              <button
                onClick={() => window.location.href = '/'}
                className="mt-2 bg-orange-900 text-white px-4 py-1 rounded-full text-[10px] font-bold"
              >
                SAIR
              </button>
            </div>
          </div>
        )}
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
          <i className="fas fa-utensils text-9xl"></i>
        </div>
        <div className="flex items-center gap-4 z-10">
          <div className="bg-white/20 p-4 rounded-2xl">
            <i className="fas fa-calendar-check text-3xl"></i>
          </div>
          <div>
            <p className="text-xs uppercase font-black opacity-80 tracking-widest">Cardápio de Hoje</p>
            <p className="font-bold text-2xl leading-tight">{todayDay}</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-center md:text-right z-10">
          <p className="text-xs uppercase font-black opacity-80 tracking-widest">Status da Cozinha</p>
          {isBusinessOpen ? (
            <p className="font-bold text-2xl flex items-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-ping"></span>
              Aceitando Pedidos
            </p>
          ) : (
            <p className="font-bold text-2xl flex items-center gap-2 text-white/50">
              <i className="fas fa-clock"></i>
              Fechado
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <MenuSection
          filteredMenu={filteredMenu}
          isBusinessOpen={isBusinessOpen}
          onAddToCart={addToCart}
          loading={isLoading}
        />

        <CartSection
          cart={cart}
          updateCartQuantity={updateCartQuantity}
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
          deliveryMethod={deliveryMethod}
          setDeliveryMethod={setDeliveryMethod}
          bairros={bairros}
          onCEPLookup={handleCEPLookup}
          subtotal={subtotal}
          selectedNeighborhoodFee={selectedNeighborhoodFee}
          total={total}
          isBusinessOpen={isBusinessOpen}
          isProcessing={isProcessing}
          onCheckout={handleCheckout}
          phoneInputRef={phoneInputRef}
          config={config}
        />
      </div>

      <OrderTrackingModal
        show={showStatusModal}
        onClose={() => { setShowStatusModal(false); setTrackedOrder(null); }}
        trackedOrder={trackedOrder}
        searchPhone={searchPhone}
        setSearchPhone={setSearchPhone}
        onTrack={handleTrackOrder}
        isSearching={isSearchingOrder}
        onResetTrackedOrder={() => { setTrackedOrder(null); setShowStatusModal(false); }}
      />

      <OptionalsModal
        show={optionalModal.show}
        marmita={optionalModal.marmita}
        selections={optionalModal.selections}
        setSelections={(selections) => setOptionalModal(prev => ({ ...prev, selections: typeof selections === 'function' ? selections(prev.selections) : selections }))}
        onClose={() => setOptionalModal({ show: false, marmita: null, selections: {} })}
        onConfirm={(marmita, allSelected) => {
          addToCart(marmita, allSelected);
          setOptionalModal({ show: false, marmita: null, selections: {} });
        }}
      />
    </div>
  );
};

export default Home;
