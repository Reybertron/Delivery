
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/database';
import { Order, Deliverer } from '../types';

const DelivererDashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [deliverer, setDeliverer] = useState<Deliverer | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const savedDeliverer = localStorage.getItem('deliverer');
        if (!savedDeliverer) {
            navigate('/delivery/login');
            return;
        }
        const parsed = JSON.parse(savedDeliverer);
        setDeliverer(parsed);
        loadOrders(parsed.id);
    }, []);

    const loadOrders = async (id: string) => {
        setLoading(true);
        try {
            const data = await db.getDelivererOrders(id);
            setOrders(data);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId: string) => {
        try {
            await db.updateOrderStatus(orderId, 'Finalizado');
            if (deliverer) loadOrders(deliverer.id);
            alert('Entrega finalizada com sucesso!');
        } catch (error) {
            alert('Erro ao atualizar status');
        }
    };

    const openInMaps = (address: string) => {
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    };

    const handleLogout = () => {
        localStorage.removeItem('deliverer');
        navigate('/delivery/login');
    };

    if (loading) return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <i className="fas fa-circle-notch fa-spin text-orange-600 text-4xl mb-4"></i>
                <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Sincronizando Entregas...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-stone-100 pb-20">
            <header className="bg-stone-900 border-b border-stone-800 p-5 sticky top-0 z-20 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                        <i className="fas fa-motorcycle text-lg"></i>
                    </div>
                    <div>
                        <h1 className="font-black text-xs uppercase tracking-widest leading-none">Painel de Entregas</h1>
                        <p className="text-[10px] text-orange-400 font-bold uppercase mt-1">{deliverer?.name}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-red-600/20 hover:text-red-500 transition-all">
                    <i className="fas fa-sign-out-alt"></i>
                </button>
            </header>

            <main className="p-4 space-y-6">
                {orders.length === 0 ? (
                    <div className="text-center py-24 text-stone-400">
                        <i className="fas fa-check-double text-6xl mb-6 opacity-10 text-stone-950"></i>
                        <p className="font-black uppercase tracking-[0.2em] text-xs">Nenhuma entrega pendente!</p>
                        <button onClick={() => deliverer && loadOrders(deliverer.id)} className="mt-6 text-[10px] font-black uppercase text-orange-600 border border-orange-200 px-6 py-2 rounded-full">Atualizar</button>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-stone-200">
                            {/* CABEÇALHO DO CARD */}
                            <div className="p-6 border-b border-stone-100 flex justify-between items-start bg-gradient-to-r from-white to-stone-50">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-stone-900 text-white text-[9px] px-3 py-1 rounded-full font-black">#{order.id.slice(-4)}</span>
                                        <span className="text-[10px] text-stone-400 font-bold uppercase">{new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <h3 className="font-black text-stone-900 text-xl uppercase tracking-tighter leading-none">{order.customerName}</h3>
                                    <p className="text-xs text-orange-600 font-black uppercase mt-1 flex items-center gap-1">
                                        <i className="fas fa-map-marker-alt"></i> {order.neighborhood}
                                    </p>
                                </div>
                                <span className={`text-[9px] font-black px-4 py-2 rounded-full border shadow-sm ${order.status === 'Entrega' ? 'bg-blue-600 text-white border-blue-400 animate-pulse' : 'bg-stone-100 text-stone-400'
                                    }`}> EM ROTA </span>
                            </div>

                            {/* ENDEREÇO DETALHADO */}
                            <div className="px-6 py-5 bg-stone-50 border-b border-stone-100">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Endereço de Entrega</h4>
                                <p className="text-sm font-bold text-stone-800 leading-snug">{order.customerAddress}</p>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => openInMaps(order.customerAddress)}
                                        className="flex-1 bg-blue-600 text-white py-3 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-transform"
                                    >
                                        <i className="fas fa-location-arrow mr-2"></i> Abrir Rota (Maps)
                                    </button>
                                    <a
                                        href={`tel:${order.customerPhone}`}
                                        className="flex-1 bg-stone-900 text-white py-3 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-lg shadow-stone-200 active:scale-95 transition-transform"
                                    >
                                        <i className="fas fa-phone-alt mr-2"></i> Chamar Cliente
                                    </a>
                                </div>
                            </div>

                            {/* ITENS DO PEDIDO */}
                            <div className="px-6 py-5 bg-white border-b border-stone-100">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Resumo do Pedido</h4>
                                <div className="space-y-2">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-stone-50/50 p-2 rounded-xl text-xs font-bold border border-stone-100">
                                            <span className="text-stone-700">{item.quantity}x {item.marmita.name}</span>
                                            <span className="text-stone-400 bg-white px-2 py-0.5 rounded-lg text-[10px] border">{(item.marmita.category || 'Marmita').toUpperCase()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* OBSERVAÇÕES (SE HOUVER) */}
                            {order.observations && (
                                <div className="px-6 py-5 bg-red-50/50 border-b border-red-100">
                                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <i className="fas fa-exclamation-triangle"></i> Atenção: Observações
                                    </h4>
                                    <p className="text-xs font-bold text-red-900 leading-relaxed italic border-l-4 border-red-500 pl-3">
                                        "{order.observations}"
                                    </p>
                                </div>
                            )}

                            {/* FINANCEIRO E PAGAMENTO */}
                            <div className="px-6 py-6 bg-stone-50 flex justify-between items-end border-b border-stone-100">
                                <div>
                                    <p className="text-[9px] font-black text-stone-400 uppercase mb-1">Pagamento</p>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-100 shadow-sm">
                                        <i className={`fas ${order.paymentMethod === 'Pix' ? 'fa-bolt text-blue-500' :
                                                order.paymentMethod === 'Cartão' ? 'fa-credit-card text-purple-500' : 'fa-money-bill-wave text-green-500'
                                            }`}></i>
                                        <span className="text-xs font-black text-stone-800 uppercase tracking-tight">{order.paymentMethod}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-stone-400 uppercase mb-1">Total a Receber</p>
                                    <p className="text-2xl font-black text-stone-900 leading-none tracking-tighter">R$ {order.total.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* BOTÃO FINALIZAR */}
                            <div className="p-6 bg-white">
                                <button
                                    onClick={() => handleUpdateStatus(order.id)}
                                    className="w-full bg-green-600 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-100 flex items-center justify-center active:scale-95 transition-transform text-xs"
                                >
                                    <i className="fas fa-check-double mr-3 text-lg"></i> Finalizar Entrega
                                </button>
                                <p className="text-[9px] text-center text-stone-300 font-bold uppercase mt-4 tracking-widest italic">Confirme os dados antes de finalizar</p>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};

export default DelivererDashboard;
