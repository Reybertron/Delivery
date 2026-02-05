import React from 'react';
import { Order, OrderStatus } from '../../types';

interface OrderTrackingModalProps {
    show: boolean;
    onClose: () => void;
    trackedOrder: Order | null;
    searchPhone: string;
    setSearchPhone: (phone: string) => void;
    onTrack: (phone?: string) => void;
    isSearching: boolean;
    onResetTrackedOrder: () => void;
}

const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
    show,
    onClose,
    trackedOrder,
    searchPhone,
    setSearchPhone,
    onTrack,
    isSearching,
    onResetTrackedOrder
}) => {
    if (!show) return null;

    const getStatusStep = (status: OrderStatus) => {
        const steps = ['Pendente', 'Preparo', 'Entrega', 'Finalizado'];
        return steps.indexOf(status);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative">
                <button
                    onClick={onClose}
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
                                    onClick={() => onTrack()}
                                    disabled={isSearching}
                                    className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
                                >
                                    {isSearching ? 'BUSCANDO...' : 'VER MEU PEDIDO'}
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
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 border-4 ${isActive ? 'bg-orange-600 border-orange-100 text-white' : 'bg-white border-stone-100 text-stone-200'
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
                                    onClick={() => onTrack()}
                                    className="bg-stone-100 text-stone-600 py-4 rounded-2xl font-black text-xs uppercase hover:bg-stone-200 transition-all"
                                >
                                    ATUALIZAR
                                </button>
                                <button
                                    onClick={onResetTrackedOrder}
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
    );
};

export default OrderTrackingModal;
