
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Marmita, DayOfWeek, OrderItem, Order, Neighborhood, Customer, DeliveryMethod, OrderStatus, AppConfig } from '../types';
import { DAYS_LIST } from '../constants';
import { generateWhatsAppLink } from '../services/whatsapp';
import { db } from '../services/database';

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

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('Entrega');
  
  const [customerInfo, setCustomerInfo] = useState({ 
    phone: '', 
    name: '', 
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '', 
    payment: 'Pix' as const 
  });

  // LOGICA SENIOR: Verificação de Horário
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
      if (cleanPhone.length >= 10) {
        try {
          const existingCustomer = await db.getCustomer(cleanPhone);
          if (existingCustomer) {
            setCustomerInfo(prev => ({
              ...prev,
              name: existingCustomer.name,
              cep: existingCustomer.cep || '',
              street: existingCustomer.street || '',
              number: existingCustomer.number || '',
              complement: existingCustomer.complement || '',
              neighborhood: existingCustomer.neighborhood || ''
            }));
          }
        } catch (e) {
          console.debug("Novo cliente detectado");
        }
      }
    };
    const timer = setTimeout(fetchCustomer, 800);
    return () => clearTimeout(timer);
  }, [customerInfo.phone]);

  const handleCEPLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setCustomerInfo(prev => ({ ...prev, cep: cleanCep }));
    
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCustomerInfo(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
          }));
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

  const filteredMenu = useMemo(() => menu.filter(m => m.day === todayDay), [menu, todayDay]);

  const addToCart = (marmita: Marmita) => {
    if (!isBusinessOpen) return;
    setCart(prev => {
      const existing = prev.find(item => item.marmita.id === marmita.id);
      if (existing) return prev.map(item => item.marmita.id === marmita.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { marmita, quantity: 1 }];
    });
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

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.marmita.price * item.quantity), 0), [cart]);
  const total = subtotal + selectedNeighborhoodFee;

  const handleCheckout = async () => {
    if (!isBusinessOpen) return;
    const { phone, name, street, number, neighborhood, payment, cep, complement } = customerInfo;
    
    if (!phone || !name || cart.length === 0) return alert('Por favor, preencha seu Nome, WhatsApp e escolha os itens!');
    if (deliveryMethod === 'Entrega' && (!street || !number || !neighborhood)) return alert('Para entrega, precisamos do endereço completo e bairro!');

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
          status: 'Pendente',
          createdAt: new Date().toISOString()
        };

        await db.saveOrder(order);
        
        localStorage.setItem('last_track_phone', cleanPhone);
        setSearchPhone(cleanPhone);
        handleTrackOrder(cleanPhone);
        
        setCart([]);
        if (config) window.open(generateWhatsAppLink(order, config), '_blank');
    } catch (e: any) {
        alert("Erro ao processar: " + e.message);
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

  const getStatusStep = (status: OrderStatus) => {
    const steps = ['Pendente', 'Preparo', 'Entrega', 'Finalizado'];
    return steps.indexOf(status);
  };

  if (isLoading) return <div className="p-20 text-center animate-pulse text-orange-600 font-black tracking-widest uppercase">Consultando Disponibilidade...</div>;
  
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
            
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-stone-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-600 hover:bg-stone-200 transition-all border border-stone-200/50"
            >
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
        <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-2 bg-orange-600 rounded-full"></div>
                <h2 className="text-3xl font-black text-stone-900 uppercase tracking-tight">O que temos para hoje?</h2>
            </div>
            
            {filteredMenu.length === 0 ? (
              <div className="bg-white p-16 rounded-[3rem] text-center border-2 border-dashed border-stone-200">
                <i className="fas fa-clock text-5xl text-stone-200 mb-6"></i>
                <p className="text-stone-400 font-bold text-xl uppercase">Estamos preparando as delícias de hoje!</p>
                <p className="text-stone-300 text-sm mt-2">Em breve o cardápio estará disponível.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMenu.map(marmita => (
                    <div key={marmita.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                              <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">{marmita.category}</span>
                              <div className="text-right">
                                <span className="block text-[10px] text-stone-400 font-bold uppercase mb-1">Preço</span>
                                <span className="font-black text-3xl text-stone-900">R$ {marmita.price.toFixed(2)}</span>
                              </div>
                            </div>
                            <h3 className="text-2xl font-bold text-stone-900 mb-3 group-hover:text-orange-600 transition-colors">{marmita.name}</h3>
                            <p className="text-stone-500 text-sm mb-8 leading-relaxed min-h-[3rem]">{marmita.description}</p>
                        </div>
                        <button 
                          onClick={() => addToCart(marmita)} 
                          disabled={!isBusinessOpen}
                          className={`w-full py-5 rounded-2xl font-black transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-3 ${
                            isBusinessOpen ? 'bg-stone-900 text-white hover:bg-orange-600' : 'bg-stone-100 text-stone-300 cursor-not-allowed shadow-none'
                          }`}
                        >
                            <i className="fas fa-plus"></i>
                            {isBusinessOpen ? 'ADICIONAR AO PEDIDO' : 'FECHADO NO MOMENTO'}
                        </button>
                    </div>
                ))}
              </div>
            )}
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white rounded-[3rem] shadow-2xl p-8 border border-stone-100 sticky top-24 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>
                <h2 className="text-2xl font-black mb-8 text-stone-800 flex items-center gap-4">
                  <div className="bg-orange-50 p-3 rounded-2xl">
                    <i className="fas fa-shopping-basket text-orange-600"></i>
                  </div>
                  Seu Pedido
                </h2>

                <div className="mb-8 space-y-4 max-h-52 overflow-y-auto pr-2 no-scrollbar border-b border-stone-50 pb-6">
                  {cart.length === 0 ? (
                    <div className="py-10 text-center">
                        <i className="fas fa-cart-arrow-down text-3xl text-stone-100 mb-2"></i>
                        <p className="text-stone-400 text-sm font-bold uppercase">Carrinho Vazio</p>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.marmita.id} className="flex justify-between items-center bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-stone-800">{item.marmita.name}</p>
                        <p className="text-[10px] text-orange-600 font-black">R$ {item.marmita.price.toFixed(2)} un.</p>
                      </div>
                      <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
                        <button onClick={() => updateCartQuantity(item.marmita.id, -1)} className="text-stone-400 hover:text-orange-600 transition-colors font-black text-lg">×</button>
                        <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.marmita.id, 1)} className="text-orange-600 font-black text-lg">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 mb-8">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="relative">
                        <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-stone-300"></i>
                        <input type="tel" placeholder="Seu WhatsApp" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:border-orange-500 outline-none font-bold" />
                      </div>
                      <div className="relative">
                        <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-stone-300"></i>
                        <input type="text" placeholder="Seu Nome Completo" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:border-orange-500 outline-none font-bold" />
                      </div>
                    </div>

                    <div className="bg-stone-100 p-1 rounded-2xl flex">
                        <button 
                            onClick={() => setDeliveryMethod('Entrega')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${deliveryMethod === 'Entrega' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-400'}`}
                        >
                            🚲 ENTREGA
                        </button>
                        <button 
                            onClick={() => setDeliveryMethod('Retirada')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${deliveryMethod === 'Retirada' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-400'}`}
                        >
                            🏠 RETIRADA
                        </button>
                    </div>

                    {deliveryMethod === 'Entrega' && (
                      <div className="space-y-4 animate-fade-in p-4 bg-orange-50/50 rounded-3xl border border-orange-100/50">
                        <input 
                          type="text" 
                          placeholder="CEP (Ex: 00000000)" 
                          value={customerInfo.cep} 
                          maxLength={8}
                          onChange={e => handleCEPLookup(e.target.value)} 
                          className="w-full px-5 py-4 bg-white border border-orange-200 rounded-2xl text-sm font-black text-orange-600 focus:ring-2 ring-orange-100 outline-none" 
                        />
                        <div className="grid grid-cols-3 gap-3">
                          <input type="text" placeholder="Rua / Av." value={customerInfo.street} onChange={e => setCustomerInfo({...customerInfo, street: e.target.value})} className="col-span-2 px-5 py-4 bg-white border border-stone-200 rounded-2xl text-xs font-bold" />
                          <input type="text" placeholder="Nº" value={customerInfo.number} onChange={e => setCustomerInfo({...customerInfo, number: e.target.value})} className="col-span-1 px-5 py-4 bg-white border border-stone-200 rounded-2xl text-xs font-bold" />
                        </div>
                        <select 
                          value={customerInfo.neighborhood} 
                          onChange={e => setCustomerInfo({...customerInfo, neighborhood: e.target.value})} 
                          className="w-full px-5 py-4 bg-white border border-stone-200 rounded-2xl text-xs font-black text-stone-700"
                        >
                          <option value="">Selecione o Bairro</option>
                          {bairros.map(b => <option key={b.name} value={b.name}>{b.name} (R$ {b.deliveryFee.toFixed(2)})</option>)}
                        </select>
                      </div>
                    )}

                    <div className="pt-4">
                      <p className="text-[10px] font-black uppercase text-stone-400 mb-3 tracking-widest text-center">Pagamento no Recebimento</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['Pix', 'Cartão', 'Dinheiro'].map(p => (
                          <button 
                            key={p} 
                            onClick={() => setCustomerInfo({...customerInfo, payment: p as any})}
                            className={`py-3 rounded-2xl text-[10px] font-black border transition-all uppercase ${customerInfo.payment === p ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white text-stone-400 border-stone-200'}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                </div>

                <div className="pt-6 mt-6 border-t border-stone-100">
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-3xl font-black text-stone-900 pt-4 mt-4 border-t border-dashed border-stone-200">
                          <span className="text-xl">TOTAL:</span>
                          <span className="text-orange-600">R$ {total.toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handleCheckout} 
                      disabled={cart.length === 0 || !isBusinessOpen} 
                      className={`w-full py-6 rounded-[2rem] font-black shadow-2xl transition-all flex items-center justify-center gap-4 text-lg ${
                        cart.length === 0 || !isBusinessOpen ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 hover:-translate-y-1'
                      }`}
                    >
                        <i className="fab fa-whatsapp text-2xl"></i>
                        {isBusinessOpen ? 'FECHAR PEDIDO' : 'FORA DE HORÁRIO'}
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* MODAL DE STATUS DO PEDIDO */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative">
                <button 
                    onClick={() => {setShowStatusModal(false); setTrackedOrder(null);}}
                    className="absolute top-6 right-6 w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-red-500 transition-all"
                >
                    <i className="fas fa-times"></i>
                </button>

                <div className="p-8">
                    {!trackedOrder ? (
                        <div className="text-center py-10">
                            <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600">
                                <i className="fas fa-search-location text-3xl"></i>
                            </div>
                            <h3 className="text-2xl font-black text-stone-900 mb-2">Rastrear Pedido</h3>
                            <p className="text-stone-400 text-sm mb-8 font-medium">Insira seu WhatsApp para ver o status</p>
                            
                            <div className="space-y-4">
                                <input 
                                    type="tel" 
                                    placeholder="Ex: 5511999999999" 
                                    value={searchPhone}
                                    onChange={e => setSearchPhone(e.target.value)}
                                    className="w-full p-5 bg-stone-50 border border-stone-200 rounded-2xl text-center font-black tracking-widest text-lg outline-none focus:border-orange-500"
                                />
                                <button 
                                    onClick={() => handleTrackOrder()}
                                    disabled={isSearchingOrder}
                                    className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
                                >
                                    {isSearchingOrder ? 'BUSCANDO...' : 'VER MEU PEDIDO'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="text-center mb-10">
                                <span className="text-[10px] font-black bg-stone-900 text-white px-3 py-1 rounded-full uppercase mb-4 inline-block">PEDIDO #{trackedOrder.id.slice(-4)}</span>
                                <h3 className="text-2xl font-black text-stone-900">Olá, {trackedOrder.customerName.split(' ')[0]}!</h3>
                                <p className="text-stone-400 text-xs font-bold uppercase mt-1">Status atual: <span className="text-orange-600">{trackedOrder.status}</span></p>
                            </div>

                            <div className="relative mb-12 px-6">
                                <div className="absolute top-1/2 left-6 right-6 h-1 bg-stone-100 -translate-y-1/2"></div>
                                <div 
                                    className="absolute top-1/2 left-6 h-1 bg-orange-600 -translate-y-1/2 transition-all duration-1000"
                                    style={{ width: `${(getStatusStep(trackedOrder.status) / 3) * 100}%` }}
                                ></div>
                                
                                <div className="relative flex justify-between">
                                    {[
                                        { s: 'Pendente', i: 'fa-clock' },
                                        { s: 'Preparo', i: 'fa-fire-burner' },
                                        { s: 'Entrega', i: 'fa-motorcycle' },
                                        { s: 'Finalizado', i: 'fa-check-double' }
                                    ].map((step, idx) => {
                                        const isActive = getStatusStep(trackedOrder.status) >= idx;
                                        return (
                                            <div key={step.s} className="flex flex-col items-center gap-2">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 border-4 ${
                                                    isActive ? 'bg-orange-600 border-orange-100 text-white' : 'bg-white border-stone-100 text-stone-200'
                                                }`}>
                                                    <i className={`fas ${step.i} text-lg`}></i>
                                                </div>
                                                <span className={`text-[10px] font-black uppercase ${isActive ? 'text-stone-900' : 'text-stone-300'}`}>{step.s}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-stone-50 p-6 rounded-3xl mb-8 space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-stone-400 font-bold uppercase">Pagamento:</span>
                                    <span className="text-stone-900 font-black">{trackedOrder.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-stone-400 font-bold uppercase">Entrega em:</span>
                                    <span className="text-stone-900 font-black text-right max-w-[150px] truncate">{trackedOrder.customerAddress}</span>
                                </div>
                                <div className="pt-3 border-t border-stone-200 flex justify-between items-center">
                                    <span className="text-stone-900 font-black uppercase">Total:</span>
                                    <span className="text-orange-600 font-black text-xl">R$ {trackedOrder.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleTrackOrder()}
                                    className="bg-stone-100 text-stone-600 py-4 rounded-2xl font-black text-xs uppercase hover:bg-stone-200 transition-all"
                                >
                                    ATUALIZAR
                                </button>
                                <button 
                                    onClick={() => {setTrackedOrder(null); setShowStatusModal(false);}}
                                    className="bg-stone-900 text-white py-4 rounded-2xl font-black text-xs uppercase hover:bg-orange-600 transition-all"
                                >
                                    ENTENDI
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      
      <style>{`
        .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default Home;
