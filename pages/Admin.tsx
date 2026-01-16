
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Marmita, DayOfWeek, Neighborhood, Customer, Order, AppConfig, OrderStatus } from '../types';
import { DAYS_LIST } from '../constants';
import { db } from '../services/database';

type AdminTab = 'pedidos' | 'caixa' | 'menu' | 'bairros' | 'clientes' | 'config';

const Admin: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('pedidos');
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'Online' | 'Offline'>('Offline');

  const [menu, setMenu] = useState<Marmita[]>([]);
  const [bairros, setBairros] = useState<Neighborhood[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchOrderPhone, setSearchOrderPhone] = useState('');

  // Estados do Menu
  const [editingMarmita, setEditingMarmita] = useState<Marmita | null>(null);
  const [marmitaForm, setMarmitaForm] = useState<Omit<Marmita, 'id'>>({
    name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: ''
  });
  const [menuDayFilter, setMenuDayFilter] = useState<DayOfWeek | 'Todos'>('Todos');

  const [bairroForm, setBairroForm] = useState<Neighborhood>({ name: '', deliveryFee: 0 });
  const [isEditingBairro, setIsEditingBairro] = useState(false);

  // Estados de Cliente
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomerOrders, setViewingCustomerOrders] = useState<Customer | null>(null);

  // Modal de Logo
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [tempLogo, setTempLogo] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const cfg = await db.getConfig();
        setConfig(cfg);
        setDbStatus('Online');
        if (!cfg.adminPassword) setIsAuthorized(true);
      } catch (e) {
        console.error("Falha de comunicação com DB");
        setDbStatus('Offline');
      }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      refreshData();
      const interval = setInterval(refreshData, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  const refreshData = async () => {
    try {
      const [m, b, o, c] = await Promise.all([
        db.getMenu(), db.getBairros(), db.getOrders(), db.getAllCustomers()
      ]);
      setMenu(Array.isArray(m) ? m : []);
      setBairros(Array.isArray(b) ? b : []);
      setOrders(Array.isArray(o) ? o : []);
      setCustomers(Array.isArray(c) ? c : []);
      setDbStatus('Online');
    } catch (e) {
      console.error("Erro na sincronização de dados");
      setDbStatus('Offline');
    }
  };

  const ordersData = useMemo(() => {
    const daily = orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate));
    const pending = daily.filter(o => o.status === 'Pendente').length;
    const preparing = daily.filter(o => o.status === 'Preparo').length;
    const delivery = daily.filter(o => o.status === 'Entrega').length;
    const finished = daily.filter(o => o.status === 'Finalizado').length;
    return { daily, pending, preparing, delivery, finished };
  }, [orders, globalDate]);

  const caixaData = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const daily = safeOrders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && o.status !== 'Cancelado');
    const total = daily.reduce((acc, o) => acc + (o.total || 0), 0);
    const count = daily.length;
    const ticketMedio = count > 0 ? total / count : 0;

    const sintético = daily.reduce((acc: any, o) => {
      acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.total;
      return acc;
    }, {});

    return { total, count, ticketMedio, sintético, dailyOrders: daily };
  }, [orders, globalDate]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Arquivo muito grande! Máximo 2MB.");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setTempLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMarmitaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Arquivo muito grande! Máximo 2MB.");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setMarmitaForm({ ...marmitaForm, imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmLogoUpdate = () => {
    if (tempLogo && config) {
      setConfig({ ...config, logoUrl: tempLogo });
      setShowLogoModal(false);
      setTempLogo(null);
    }
  };

  const handleSaveMarmita = async () => {
    if (!marmitaForm.name || marmitaForm.price <= 0) return alert('Campos inválidos');
    try {
      if (editingMarmita) await db.updateMarmita(editingMarmita.id, marmitaForm);
      else await db.saveMarmita(marmitaForm);
      setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '' });
      setEditingMarmita(null);
      refreshData();
      alert("Prato salvo com sucesso!");
    } catch (e) { alert("Erro ao salvar marmita"); }
  };

  const handleSaveBairro = async () => {
    if (!bairroForm.name) return alert('Nome do bairro obrigatório');
    try {
      await db.saveBairro(bairroForm);
      setBairroForm({ name: '', deliveryFee: 0 });
      setIsEditingBairro(false);
      refreshData();
      alert("Taxa atualizada!");
    } catch (e) { alert("Erro ao salvar bairro"); }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    try {
      await db.saveCustomer(editingCustomer);
      setEditingCustomer(null);
      refreshData();
      alert("Dados do cliente atualizados com sucesso!");
    } catch (e) { alert("Erro ao atualizar cliente"); }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await db.saveConfig(config);
      alert("Configurações salvas!");
      window.location.reload();
    } catch (e) { alert("Erro ao salvar configurações"); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (config && passwordInput === config.adminPassword) setIsAuthorized(true);
    else alert('Senha Administrativa Inválida');
  };

  const printOrder = (order: Order) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const itemsHtml = Array.isArray(order.items)
      ? order.items.map(i => `<div class="item-row"><span>${i.quantity}x ${i.marmita?.name || 'Item'}</span><span>R$${((i.quantity || 1) * (i.marmita?.price || 0)).toFixed(2)}</span></div>`).join('')
      : '<div>Nenhum item detalhado</div>';

    const dateStr = new Date(order.createdAt).toLocaleString('pt-BR');

    // Configura o estilo da impressão para 80mm (papel térmico comum)
    const content = `
      <html>
      <head>
        <title>Pedido #${order.id.slice(-4)}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 5px; font-size: 13px; color: #000; font-weight: bold; }
          .header { text-align: center; margin-bottom: 10px; }
          .header h3 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
          .header p { margin: 2px 0; font-size: 14px; }
          .divider { border-top: 2px dashed #000; margin: 10px 0; }
          .label { font-weight: 900; font-size: 14px; }
          .total-row { font-size: 16px; font-weight: 900; margin-top: 10px; display: flex; justify-content: space-between; border-top: 2px solid #000; pt: 5px; }
          .item-list { margin: 10px 0; }
          .info-block { margin-bottom: 8px; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>${config?.businessName || 'Delivery'}</h3>
          <p>Pedido #${order.id.slice(-4)}</p>
          <p>${dateStr}</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="info-block">
          <div class="label">CLIENTE</div>
          <div>${order.customerName}</div>
          <div>${order.customerPhone}</div>
        </div>

        <div class="info-block">
          <div class="label">ENTREGA (${order.deliveryMethod.toUpperCase()})</div>
          ${order.deliveryMethod === 'Retirada'
        ? '<div>Retirada no Balcão</div>'
        : `
              <div>${order.customerAddress}</div>
              <div class="label" style="margin-top:2px">BAIRRO:</div>
              <div>${order.neighborhood}</div>
            `}
        </div>

        <div class="divider"></div>
        
        <div class="label">ITENS DO PEDIDO</div>
        <div class="item-list">
          ${itemsHtml}
        </div>

        <div class="divider"></div>

        <div style="display:flex; justify-content:space-between;">
            <span>Forma Pagto:</span>
            <span>${order.paymentMethod}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Subtotal:</span>
            <span>R$ ${order.subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Taxa Entrega:</span>
            <span>R$ ${(order.deliveryFee || 0).toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="total-row">
            <span>TOTAL A PAGAR:</span>
            <span style="font-size:16px;">R$ ${(order.total || 0).toFixed(2)}</span>
        </div>
        
        <br>
        <div style="text-align:center; font-size:10px;">
           www.panelasdavanda.com.br
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(window.close, 500);
          };
        </script>
      </body>
      </html>
    `;

    win.document.write(content);
    win.document.close();
  };

  const filteredMenuList = useMemo(() => {
    if (menuDayFilter === 'Todos') return menu;
    return menu.filter(m => m.day === menuDayFilter);
  }, [menu, menuDayFilter]);

  if (isLoading) return <div className="p-20 text-center font-black text-stone-300 animate-pulse tracking-[0.5em]">DBA: SINCRONIZANDO COM O SERVIDOR...</div>;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-md text-center border border-stone-200">
          <div className="bg-stone-900 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
            <i className="fas fa-shield-halved text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter text-stone-800">Autenticação Master</h2>
          <input type="password" placeholder="SENHA DO SISTEMA" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full p-6 bg-stone-50 rounded-3xl mb-6 text-center font-black tracking-[0.6em] outline-none border-2 border-stone-100 focus:border-orange-500 transition-all" />
          <button className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase hover:bg-orange-600 transition-all shadow-xl shadow-stone-200">Acessar Painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-40">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
        <div className="flex items-center gap-6">
          {config?.logoUrl && <img src={config.logoUrl} className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-lg" alt="Logo" />}
          <div>
            <h1 className="text-3xl font-black text-stone-900 uppercase leading-none tracking-tighter">Gestão Sênior</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              DB Connection: <span className={dbStatus === 'Online' ? 'text-green-500' : 'text-red-500'}>{dbStatus}</span>
              <span className={`w-2 h-2 rounded-full ${dbStatus === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            </p>
          </div>
        </div>

        <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-stone-200 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'pedidos', icon: 'fa-clipboard-list', label: 'Pedidos' },
            { id: 'caixa', icon: 'fa-chart-pie', label: 'Financeiro' },
            { id: 'menu', icon: 'fa-utensils', label: 'Cardápio' },
            { id: 'bairros', icon: 'fa-truck-fast', label: 'Bairros' },
            { id: 'clientes', icon: 'fa-address-book', label: 'Clientes' },
            { id: 'config', icon: 'fa-sliders', label: 'Config' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-900'}`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-sm border border-stone-100 p-10 min-h-[700px] relative">

        {activeTab === 'pedidos' && (
          <>
            {/* FILA DE PRODUÇÃO (ATIVOS) */}
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center border-b border-stone-50 pb-8 gap-4">
                <h3 className="text-2xl font-black uppercase text-stone-800 tracking-tight">Fila de Produção</h3>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow md:flex-grow-0">
                    <i className="fas fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-sm"></i>
                    <input
                      type="text"
                      placeholder="Filtrar Fone..."
                      value={searchOrderPhone}
                      onChange={e => setSearchOrderPhone(e.target.value)}
                      className="pl-10 pr-4 py-4 bg-stone-50 rounded-2xl font-black border-2 border-stone-100 outline-none focus:border-orange-500 shadow-sm w-full md:w-48 text-xs"
                    />
                  </div>
                  <input
                    type="date"
                    value={globalDate}
                    onChange={e => setGlobalDate(e.target.value)}
                    className="p-4 bg-stone-50 rounded-2xl font-black border-2 border-stone-100 outline-none focus:border-orange-500 shadow-sm text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && !['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).length === 0 ? (
                  <div className="col-span-full py-20 text-center text-stone-200 uppercase font-black tracking-[0.5em]">Tudo limpo por aqui!</div>
                ) : orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && !['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).map(order => (
                  <div key={order.id} className={`p-8 rounded-[2.5rem] border-2 transition-all hover:shadow-xl ${order.status === 'Pendente' ? 'bg-orange-50 border-orange-200' : 'bg-white border-stone-100'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-white text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-tighter">#{order.id.slice(-4)}</span>
                        <span className="text-[10px] font-bold text-stone-400"><i className="far fa-clock mr-1"></i>{new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border ${order.status === 'Entrega' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-600 text-white border-orange-400'}`}>{order.status}</span>
                    </div>

                    <h4 className="font-black text-stone-900 text-lg leading-none mb-1">{order.customerName}</h4>
                    <p className="text-[10px] text-stone-400 font-bold mb-4 uppercase tracking-wider">{order.customerAddress}</p>

                    {/* LISTA DE ITENS RÁPIDA */}
                    <div className="bg-white/50 rounded-xl p-3 mb-4 border border-stone-100/50 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-b border-dashed border-stone-200 last:border-0 pb-2 last:pb-0">
                          {item.marmita.imageUrl && <img src={item.marmita.imageUrl} className="w-8 h-8 rounded-lg object-cover" />}
                          <div className="flex-1">
                            <div className="flex justify-between text-[11px] font-bold text-stone-700">
                              <span>{item.quantity}x {item.marmita.name}</span>
                            </div>
                            {item.marmita.prepTime && <p className="text-[9px] text-stone-400 flex items-center gap-1"><i className="fas fa-clock"></i> {item.marmita.prepTime}</p>}
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 mt-1 border-t border-stone-200 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                          <span>Produtos:</span>
                          <span>R$ {order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                          <span>Taxa:</span>
                          <span>R$ {order.deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-stone-100 flex justify-between text-xs font-black text-stone-900">
                          <span>TOTAL:</span>
                          <span>R$ {order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => printOrder(order)} className="flex-1 bg-white border-2 border-stone-100 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-stone-50 transition-all shadow-sm"><i className="fas fa-print mr-2"></i>Imprimir</button>
                      <select value={order.status} onChange={e => db.updateOrderStatus(order.id, e.target.value as any).then(refreshData)} className="flex-1 bg-stone-900 text-white py-3 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 ring-orange-500/20 cursor-pointer">
                        {['Pendente', 'Preparo', 'Entrega', 'Finalizado', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PEDIDOS FINALIZADOS (HISTÓRICO DO DIA) */}
            <div className="space-y-6 pt-12 border-t border-stone-100 animate-fade-in">
              <h3 className="text-xl font-black uppercase text-stone-400 tracking-tight flex items-center gap-3">
                <i className="fas fa-check-double"></i>
                Histórico Finalizado
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-75 hover:opacity-100 transition-opacity">
                {orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && ['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).length === 0 ? (
                  <div className="col-span-full py-10 text-center text-stone-200 uppercase font-black tracking-widest text-xs">Nenhum pedido finalizado hoje</div>
                ) : orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && ['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).map(order => (
                  <div key={order.id} className="p-5 rounded-[2rem] border border-stone-100 bg-stone-50">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-[9px] font-black text-stone-400 mr-2">#{order.id.slice(-4)}</span>
                        <span className="text-[9px] font-bold text-stone-300">{new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${order.status === 'Cancelado' ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>{order.status}</span>
                    </div>
                    <h4 className="font-bold text-stone-700 text-sm truncate">{order.customerName}</h4>
                    <p className="text-[10px] text-stone-400 mb-3 truncate">{order.items.length} itens • R$ {order.total.toFixed(2)}</p>
                    <button onClick={() => printOrder(order)} className="w-full bg-white border border-stone-200 py-2 rounded-xl text-[9px] font-black uppercase text-stone-400 hover:text-stone-900 transition-all">Reimprimir</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'caixa' && (
          <div className="space-y-8 animate-fade-in">
            {/* Header Reduzido */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-stone-50 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center text-lg shadow-lg">
                  <i className="fas fa-sack-dollar"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-stone-800 tracking-tighter">Fluxo de Caixa</h3>
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Resumo Analítico da Operação</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-stone-400">Data Base:</span>
                <input type="date" value={globalDate} onChange={e => setGlobalDate(e.target.value)} className="p-3 bg-stone-50 rounded-xl font-black border-2 border-stone-100 outline-none focus:border-orange-500 text-xs shadow-sm" />
              </div>
            </div>

            {/* Dash Compacto */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100 flex flex-col justify-center">
                <span className="text-[9px] font-black uppercase text-green-600 mb-1 tracking-widest">Receita do Dia</span>
                <span className="text-3xl font-black text-green-700">R$ {caixaData.total.toFixed(2)}</span>
              </div>
              <div className="bg-stone-900 p-6 rounded-[2rem] text-white flex flex-col justify-center">
                <span className="text-[9px] font-black uppercase opacity-60 mb-1 tracking-widest">Pedidos Pagos</span>
                <span className="text-3xl font-black">{caixaData.count}</span>
              </div>
              <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 flex flex-col justify-center">
                <span className="text-[9px] font-black uppercase text-orange-600 mb-1 tracking-widest">Ticket Médio</span>
                <span className="text-3xl font-black text-orange-700">R$ {caixaData.ticketMedio.toFixed(2)}</span>
              </div>
              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                <span className="text-[9px] font-black uppercase text-blue-600 mb-2 tracking-widest block text-center">Formas de Pagamento</span>
                <div className="flex justify-around gap-2">
                  {Object.entries(caixaData.sintético).map(([method, val]: any) => (
                    <div key={method} className="text-center">
                      <span className="text-[8px] font-black uppercase text-blue-400 block">{method}</span>
                      <span className="text-[11px] font-black text-blue-900">R${val.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Listagem Analítica de Pedidos do Dia */}
            <div className="bg-stone-50 rounded-[3rem] border border-stone-100 overflow-hidden">
              <div className="p-6 bg-white border-b border-stone-100 flex justify-between items-center">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">Detalhamento de Entradas (Pedidos Consolidados)</h4>
                <span className="text-[10px] font-black text-stone-300 uppercase">Apenas pedidos não cancelados</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100/50">
                      <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">ID</th>
                      <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">Cliente</th>
                      <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 text-center">Status</th>
                      <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 text-center">Pagamento</th>
                      <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {caixaData.dailyOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-stone-300 uppercase font-black tracking-widest text-xs">Sem movimentação financeira para esta data</td>
                      </tr>
                    ) : caixaData.dailyOrders.map(o => (
                      <tr key={o.id} className="hover:bg-white transition-colors group">
                        <td className="p-5">
                          <span className="text-[10px] font-black text-stone-400 group-hover:text-stone-900 transition-colors">#{o.id.slice(-4)}</span>
                        </td>
                        <td className="p-5">
                          <p className="text-xs font-black text-stone-800 uppercase tracking-tighter">{o.customerName}</p>
                          <p className="text-[10px] text-stone-400 font-bold">{o.customerPhone}</p>
                        </td>
                        <td className="p-5 text-center">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${o.status === 'Finalizado' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                            }`}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-5 text-center">
                          <span className="text-[10px] font-black text-stone-500 uppercase">{o.paymentMethod}</span>
                        </td>
                        <td className="p-5 text-right">
                          <span className="text-sm font-black text-stone-900 tracking-tighter">R$ {o.total.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-stone-900 text-white">
                    <tr>
                      <td colSpan={4} className="p-5 text-right text-[10px] font-black uppercase tracking-widest">Consolidado Total</td>
                      <td className="p-5 text-right font-black text-xl tracking-tighter">R$ {caixaData.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 animate-fade-in">
            <div className="space-y-8">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">{editingMarmita ? 'Editar Prato' : 'Novo Cardápio'}</h3>
              <div className="space-y-5 bg-stone-50 p-10 rounded-[4rem] border border-stone-100 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Prato</label>
                  <input type="text" placeholder="Ex: Bife com Fritas" value={marmitaForm.name} onChange={e => setMarmitaForm({ ...marmitaForm, name: e.target.value })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-sm transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Descrição / Ingredientes</label>
                  <textarea
                    placeholder="Descreva os ingredientes..."
                    rows={3}
                    value={marmitaForm.description}
                    onChange={e => setMarmitaForm({ ...marmitaForm, description: e.target.value })}
                    className="w-full p-6 rounded-3xl border-2 border-white outline-none font-medium focus:border-orange-500 shadow-sm transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4 flex items-center gap-2">
                    <i className="fas fa-image text-orange-500"></i> URL ou Upload da Imagem
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={marmitaForm.imageUrl || ''}
                      onChange={e => setMarmitaForm({ ...marmitaForm, imageUrl: e.target.value })}
                      className="w-full pl-6 pr-16 py-6 rounded-3xl border-2 border-white outline-none font-medium focus:border-orange-500 shadow-sm transition-all text-xs"
                    />
                    <label className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-all shadow-lg active:scale-90">
                      <i className="fas fa-camera"></i>
                      <input type="file" className="hidden" accept="image/*" onChange={handleMarmitaImageUpload} />
                    </label>
                  </div>

                  {marmitaForm.imageUrl && (
                    <div className="relative mt-2 w-full h-32 rounded-3xl overflow-hidden border-2 border-white shadow-inner bg-stone-100 group">
                      <img src={marmitaForm.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                      <button
                        onClick={() => setMarmitaForm({ ...marmitaForm, imageUrl: '' })}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4 flex items-center gap-2">
                    <i className="fas fa-clock text-orange-500"></i> Tempo de Preparo
                  </label>
                  <div className="relative">
                    <i className="far fa-hourglass-half absolute left-6 top-1/2 -translate-y-1/2 text-stone-300"></i>
                    <input
                      type="text"
                      placeholder="Ex: 20-30 min"
                      value={marmitaForm.prepTime || ''}
                      onChange={e => setMarmitaForm({ ...marmitaForm, prepTime: e.target.value })}
                      className="w-full pl-14 pr-6 py-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-stone-300 text-xs">R$</span>
                      <input type="number" step="0.01" placeholder="0.00" value={marmitaForm.price} onChange={e => setMarmitaForm({ ...marmitaForm, price: parseFloat(e.target.value) })} className="w-full pl-12 pr-6 py-6 rounded-3xl border-2 border-white outline-none font-black focus:border-orange-500 shadow-sm transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Categoria</label>
                    <select value={marmitaForm.category} onChange={e => setMarmitaForm({ ...marmitaForm, category: e.target.value as any })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold shadow-sm cursor-pointer focus:border-orange-500 appearance-none bg-white">
                      {['Pequena', 'Média', 'Grande', 'Executiva'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Dia da Semana</label>
                  <select value={marmitaForm.day} onChange={e => setMarmitaForm({ ...marmitaForm, day: e.target.value as DayOfWeek })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold shadow-sm cursor-pointer focus:border-orange-500 appearance-none bg-white">
                    {DAYS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <button onClick={handleSaveMarmita} className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-orange-600 transition-all transform active:scale-95 mt-4 flex items-center justify-center gap-3">
                  <i className={`fas ${editingMarmita ? 'fa-save' : 'fa-plus-circle'} text-lg`}></i>
                  {editingMarmita ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                </button>
                {editingMarmita && (
                  <button onClick={() => {
                    setEditingMarmita(null);
                    setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '' });
                  }} className="w-full text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                    Cancelar Edição
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Produtos Cadastrados</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-stone-400">Filtrar Dia:</span>
                  <select
                    value={menuDayFilter}
                    onChange={(e) => setMenuDayFilter(e.target.value as any)}
                    className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none focus:border-orange-500"
                  >
                    <option value="Todos">Todos</option>
                    {DAYS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[700px] overflow-y-auto pr-4 no-scrollbar">
                {filteredMenuList.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-stone-200 uppercase font-black tracking-[0.2em]">Nenhum prato encontrado</div>
                ) : filteredMenuList.map(m => (
                  <div key={m.id} className="flex flex-col p-8 bg-stone-50 rounded-[3rem] border border-stone-100 hover:border-orange-200 hover:bg-white transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">
                            {m.category}
                          </span>
                          {m.prepTime && (
                            <span className="text-[9px] font-black uppercase text-stone-500 bg-stone-200 px-3 py-1.5 rounded-full flex items-center gap-1">
                              <i className="fas fa-clock"></i> {m.prepTime}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">{m.day}</p>
                        {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-32 object-cover rounded-2xl mb-3 shadow-sm" />}
                        <h5 className="font-bold text-stone-800 text-base leading-tight">{m.name}</h5>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingMarmita(m); setMarmitaForm(m); }} className="w-10 h-10 bg-white text-blue-500 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"><i className="fas fa-edit"></i></button>
                        <button onClick={() => { if (confirm("Excluir item?")) db.deleteMarmita(m.id).then(refreshData); }} className="w-10 h-10 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"><i className="fas fa-trash"></i></button>
                      </div>
                    </div>

                    <p className="text-stone-500 text-xs mb-4 line-clamp-2 min-h-[2rem]">{m.description || 'Sem descrição informada.'}</p>

                    <div className="mt-auto pt-4 border-t border-stone-100 flex justify-between items-center">
                      <span className="font-black text-stone-900 text-lg">R$ {m.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bairros' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-fade-in">
            <div className="space-y-8">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Zonas de Entrega</h3>
              <div className="space-y-6 p-12 bg-stone-50 rounded-[4rem] border border-stone-100 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Bairro</label>
                  <input type="text" placeholder="Ex: Centro" value={bairroForm.name} onChange={e => setBairroForm({ ...bairroForm, name: e.target.value })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Taxa de Entrega (R$)</label>
                  <input type="number" placeholder="0.00" value={bairroForm.deliveryFee} onChange={e => setBairroForm({ ...bairroForm, deliveryFee: parseFloat(e.target.value) })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-black focus:border-orange-500 shadow-inner" />
                </div>
                <button onClick={handleSaveBairro} className="w-full bg-stone-900 text-white py-7 rounded-[2rem] font-black uppercase shadow-2xl hover:bg-orange-600 transition-all text-sm tracking-widest">
                  {isEditingBairro ? 'Atualizar Taxa' : 'Registrar Bairro'}
                </button>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Malha Ativa</h3>
              <div className="grid gap-4">
                {(bairros || []).map(b => (
                  <div key={b.name} className="flex justify-between items-center p-8 bg-stone-50 rounded-[2.5rem] border border-stone-100 group transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1">
                    <span className="font-black text-stone-800 text-lg uppercase tracking-tighter">{b.name}</span>
                    <div className="flex items-center gap-8">
                      <span className="font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl text-base shadow-sm">R$ {b.deliveryFee.toFixed(2)}</span>
                      <div className="flex gap-4">
                        <button onClick={() => { setBairroForm(b); setIsEditingBairro(true); }} className="text-blue-500 hover:scale-150 transition-transform"><i className="fas fa-edit text-xl"></i></button>
                        <button onClick={() => { if (confirm("Excluir bairro?")) db.deleteBairro(b.name).then(refreshData); }} className="text-red-400 hover:scale-150 transition-transform"><i className="fas fa-circle-xmark text-xl"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clientes' && (
          <div className="space-y-12 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-stone-50 pb-12">
              <h3 className="text-3xl font-black uppercase text-stone-900 tracking-tighter">Base de Clientes (CRM)</h3>
              <div className="relative w-full max-w-xl">
                <i className="fas fa-search absolute left-8 top-1/2 -translate-y-1/2 text-stone-300 text-xl"></i>
                <input type="text" placeholder="Filtrar por Nome ou WhatsApp..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="w-full pl-20 pr-8 py-7 bg-stone-50 rounded-[2.5rem] border-2 border-stone-100 outline-none font-bold focus:border-orange-500 shadow-inner text-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {(customers || []).filter(c => (c.name || '').toLowerCase().includes(searchCustomer.toLowerCase()) || (c.phone || '').includes(searchCustomer)).map(c => (
                <div key={c.phone} className="p-12 bg-stone-50 rounded-[4rem] border border-stone-100 relative group hover:shadow-2xl transition-all hover:-translate-y-2 bg-gradient-to-br from-stone-50 to-white">
                  <div className="flex justify-between items-start mb-8">
                    <div className="bg-stone-900 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl">
                      <i className="fas fa-user-circle text-2xl"></i>
                    </div>
                    <button onClick={() => setEditingCustomer(c)} className="text-stone-300 hover:text-blue-600 transition-all transform hover:scale-125"><i className="fas fa-user-pen text-xl"></i></button>
                  </div>

                  <h5 className="font-black text-stone-900 text-2xl leading-none mb-3 uppercase tracking-tighter truncate">{c.name}</h5>
                  <p className="text-orange-600 font-black text-sm mb-8 flex items-center gap-3 tracking-widest"><i className="fab fa-whatsapp text-lg"></i> {c.phone}</p>

                  <button onClick={() => setViewingCustomerOrders(c)} className="w-full bg-white border-2 border-stone-100 text-stone-400 font-black uppercase py-4 rounded-2xl hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all text-xs tracking-widest shadow-sm">
                    <i className="fas fa-history mr-2"></i> Ver Histórico
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            <div className="space-y-10">
              {/* SESSÃO DE LOGO */}
              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter">
                <div className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-xl shadow-blue-100"><i className="fas fa-image"></i></div>
                Identidade Visual
              </h3>
              <div className="bg-stone-50 p-12 rounded-[4rem] border border-stone-100 flex flex-col md:flex-row items-center gap-12">
                <div className="w-40 h-40 bg-white rounded-[3rem] shadow-2xl border-4 border-white overflow-hidden flex items-center justify-center relative group">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  ) : (
                    <i className="fas fa-store text-5xl text-stone-200"></i>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-xl font-black text-stone-900 uppercase mb-4">Logo do Negócio</h4>
                  <p className="text-stone-400 text-sm font-medium mb-8">Esta imagem aparece no topo do site e nas comandas de impressão.</p>
                  <button
                    onClick={() => setShowLogoModal(true)}
                    className="bg-stone-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-600 transition-all shadow-xl"
                  >
                    Alterar Logomarca
                  </button>
                </div>
              </div>

              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-16">
                <div className="bg-orange-600 text-white p-5 rounded-[2rem] shadow-xl shadow-orange-100"><i className="fas fa-clock"></i></div>
                Horário de Atendimento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-stone-50 p-12 rounded-[4rem] border border-stone-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Abertura dos Pedidos</label>
                  <input type="time" value={config.openingTime} onChange={e => setConfig({ ...config, openingTime: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Fechamento dos Pedidos</label>
                  <input type="time" value={config.closingTime} onChange={e => setConfig({ ...config, closingTime: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <p className="md:col-span-2 text-[10px] text-stone-400 font-bold uppercase text-center">Clientes fora deste horário verão um modal informativo e não poderão fechar pedidos.</p>
              </div>

              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-16">
                <div className="bg-stone-900 text-white p-5 rounded-[2rem] shadow-xl"><i className="fas fa-fingerprint"></i></div>
                Informações de Contato
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-stone-50 p-12 rounded-[4rem] border border-stone-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Nome do Negócio</label>
                  <input type="text" value={config.businessName} onChange={e => setConfig({ ...config, businessName: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">WhatsApp para Pedidos</label>
                  <input type="text" value={config.businessWhatsApp} onChange={e => setConfig({ ...config, businessWhatsApp: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Senha do Administrador</label>
                  <input type="password" value={config.adminPassword || ''} onChange={e => setConfig({ ...config, adminPassword: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 tracking-[1em] shadow-sm" />
                </div>

                <button onClick={handleSaveConfig} className="md:col-span-2 w-full bg-stone-900 text-white py-8 rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-orange-600 transition-all mt-8 text-lg tracking-widest flex items-center justify-center gap-4 group">
                  <i className="fas fa-save text-2xl group-hover:scale-110 transition-transform"></i>
                  Efetivar Configurações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE UPLOAD DE LOGO */}
      {
        showLogoModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 text-center shadow-2xl relative">
              <button onClick={() => { setShowLogoModal(false); setTempLogo(null); }} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-8">Atualizar Logomarca</h3>

              <div className="w-48 h-48 bg-stone-50 rounded-[3rem] mx-auto mb-10 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                {tempLogo || config?.logoUrl ? (
                  <img src={tempLogo || config?.logoUrl} className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-cloud-arrow-up text-5xl text-stone-200"></i>
                )}
                <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-stone-900/0 group-hover:bg-stone-900/40 transition-all opacity-0 group-hover:opacity-100">
                  <span className="text-white font-black uppercase text-[10px] tracking-widest">Escolher Arquivo</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>

              <div className="space-y-4">
                {tempLogo && (
                  <button onClick={confirmLogoUpdate} className="w-full bg-green-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all">Confirmar Alteração</button>
                )}
                <button onClick={() => { setShowLogoModal(false); setTempLogo(null); }} className="w-full bg-stone-100 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL DE EDIÇÃO DE CLIENTE */}
      {
        editingCustomer && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-xl rounded-[3.5rem] p-12 shadow-2xl relative">
              <button onClick={() => setEditingCustomer(null)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-8">Editar Cliente</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Cliente</label>
                  <input type="text" value={editingCustomer.name} onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Telefone (ID)</label>
                  <input type="text" readOnly value={editingCustomer.phone} className="w-full p-4 rounded-2xl border-2 border-stone-100 bg-stone-100 outline-none font-bold text-stone-400 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Rua / Av.</label>
                  <input type="text" value={editingCustomer.street} onChange={e => setEditingCustomer({ ...editingCustomer, street: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Número</label>
                  <input type="text" value={editingCustomer.number} onChange={e => setEditingCustomer({ ...editingCustomer, number: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Bairro</label>
                  <select
                    value={editingCustomer.neighborhood}
                    onChange={e => setEditingCustomer({ ...editingCustomer, neighborhood: e.target.value })}
                    className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 shadow-inner"
                  >
                    <option value="">Selecione...</option>
                    {bairros.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">CEP</label>
                  <input type="text" value={editingCustomer.cep} onChange={e => setEditingCustomer({ ...editingCustomer, cep: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 shadow-inner" />
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button onClick={handleSaveCustomer} className="flex-1 bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all shadow-xl">Salvar Alterações</button>
                <button onClick={() => setEditingCustomer(null)} className="flex-1 bg-stone-100 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL DE HISTÓRICO DE PEDIDOS POR CLIENTE */}
      {viewingCustomerOrders && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[3.5rem] p-10 shadow-2xl relative flex flex-col">
            <button onClick={() => setViewingCustomerOrders(null)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>

            <div className="mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-1">Histórico de Pedidos</h3>
              <p className="text-stone-400 font-bold uppercase text-xs tracking-widest">{viewingCustomerOrders.name}</p>
              <p className="text-orange-500 font-bold text-[10px] tracking-widest mt-1"><i className="fab fa-whatsapp"></i> {viewingCustomerOrders.phone}</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 -mr-2 scrollbar-hide">
              {orders.filter(o => o.customerPhone.replace(/\D/g, '') === viewingCustomerOrders.phone.replace(/\D/g, '')).length === 0 ? (
                <div className="text-center py-20 text-stone-300 font-black uppercase tracking-widest">Nenhum pedido encontrado</div>
              ) : (
                orders.filter(o => o.customerPhone.replace(/\D/g, '') === viewingCustomerOrders.phone.replace(/\D/g, ''))
                  .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
                  .map(order => (
                    <div key={order.id} className="p-6 rounded-[2rem] bg-stone-50 border border-stone-100 flex justify-between items-center group hover:bg-white hover:border-orange-200 transition-all">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[9px] font-black bg-stone-200 text-stone-600 px-3 py-1 rounded-full tracking-wider">{new Date(order.createdAt || '').toLocaleDateString('pt-BR')} • {new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${['Finalizado'].includes(order.status) ? 'bg-green-100 text-green-600' : ['Cancelado'].includes(order.status) ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{order.status}</span>
                          <span className="text-[9px] font-black text-stone-300">#{order.id.slice(-4)}</span>
                        </div>
                        <p className="text-[11px] font-bold text-stone-700 leading-tight mb-2 line-clamp-2">{order.items.map(i => `${i.quantity}x ${i.marmita.name}`).join(', ')}</p>
                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest flex items-center gap-4">
                          <span>Produtos: <span className="text-stone-900">R$ {order.subtotal.toFixed(2)}</span></span>
                          <span>Taxa: <span className="text-stone-900">R$ {order.deliveryFee.toFixed(2)}</span></span>
                          <span className="ml-auto text-xs text-orange-600">Total: R$ {order.total.toFixed(2)}</span>
                        </p>
                      </div>
                      <button onClick={() => printOrder(order)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-stone-300 hover:text-stone-900 hover:bg-stone-100 transition-all shadow-sm border border-stone-100">
                        <i className="fas fa-print"></i>
                      </button>
                    </div>
                  ))
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
    </div >
  );
};

export default Admin;
