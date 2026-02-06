import React from 'react';
import { OrderItem, Neighborhood, DeliveryMethod } from '../../types';

interface CartSectionProps {
    cart: OrderItem[];
    updateCartQuantity: (id: string, delta: number) => void;
    customerInfo: {
        phone: string;
        name: string;
        cep: string;
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        payment: 'Pix' | 'Cartão' | 'Dinheiro';
        observations: string;
    };
    setCustomerInfo: React.Dispatch<React.SetStateAction<any>>;
    deliveryMethod: DeliveryMethod;
    setDeliveryMethod: (method: DeliveryMethod) => void;
    bairros: Neighborhood[];
    onCEPLookup: (cep: string) => void;
    subtotal: number;
    selectedNeighborhoodFee: number;
    total: number;
    isBusinessOpen: boolean;
    isProcessing: boolean;
    onCheckout: () => void;
    phoneInputRef: React.RefObject<HTMLInputElement | null>;
}

const CartSection: React.FC<CartSectionProps> = ({
    cart,
    updateCartQuantity,
    customerInfo,
    setCustomerInfo,
    deliveryMethod,
    setDeliveryMethod,
    bairros,
    onCEPLookup,
    subtotal,
    selectedNeighborhoodFee,
    total,
    isBusinessOpen,
    isProcessing,
    onCheckout,
    phoneInputRef
}) => {
    return (
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
                    ) : cart.map((item, index) => {
                        const itemPrice = item.marmita.price + (item.selectedOptionals || []).reduce((sum, opt) => sum + opt.precoAdicional, 0);
                        return (
                            <div key={index} className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-stone-800">{item.marmita.name}</p>
                                        <p className="text-[10px] text-orange-600 font-black">R$ {itemPrice.toFixed(2)} un.</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
                                        <button onClick={() => updateCartQuantity(item.marmita.id, -1)} className="text-stone-400 hover:text-orange-600 transition-colors font-black text-lg">×</button>
                                        <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateCartQuantity(item.marmita.id, 1)} className="text-orange-600 font-black text-lg">+</button>
                                    </div>
                                </div>
                                {item.selectedOptionals && item.selectedOptionals.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {item.selectedOptionals.map(opt => (
                                            <span key={opt.id} className="text-[9px] bg-white border border-stone-200 text-stone-500 px-2 py-0.5 rounded-full font-bold">
                                                + {opt.nome}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-4 mb-8">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                            <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-stone-300"></i>
                            <input
                                type="tel"
                                ref={phoneInputRef}
                                placeholder="Seu WhatsApp"
                                value={customerInfo.phone}
                                onChange={e => setCustomerInfo((prev: any) => ({ ...prev, phone: e.target.value }))}
                                className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:border-orange-500 outline-none font-bold"
                            />
                        </div>
                        <div className="relative">
                            <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-stone-300"></i>
                            <input type="text" placeholder="Seu Nome Completo" value={customerInfo.name} onChange={e => setCustomerInfo((prev: any) => ({ ...prev, name: e.target.value }))} className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:border-orange-500 outline-none font-bold" />
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
                                onChange={e => onCEPLookup(e.target.value)}
                                className="w-full px-5 py-4 bg-white border border-orange-200 rounded-2xl text-sm font-black text-orange-600 focus:ring-2 ring-orange-100 outline-none"
                            />
                            <div className="grid grid-cols-3 gap-3">
                                <input type="text" placeholder="Rua / Av." value={customerInfo.street} onChange={e => setCustomerInfo((prev: any) => ({ ...prev, street: e.target.value }))} className="col-span-2 px-5 py-4 bg-white border border-stone-200 rounded-2xl text-xs font-bold" />
                                <input type="text" placeholder="Nº" value={customerInfo.number} onChange={e => setCustomerInfo((prev: any) => ({ ...prev, number: e.target.value }))} className="col-span-1 px-5 py-4 bg-white border border-stone-200 rounded-2xl text-xs font-bold" />
                            </div>
                            <select
                                value={customerInfo.neighborhood}
                                onChange={e => setCustomerInfo((prev: any) => ({ ...prev, neighborhood: e.target.value }))}
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
                                    onClick={() => setCustomerInfo((prev: any) => ({ ...prev, payment: p as any }))}
                                    className={`py-3 rounded-2xl text-[10px] font-black border transition-all uppercase ${customerInfo.payment === p ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white text-stone-400 border-stone-200'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4">
                        <label className="text-[10px] font-black uppercase text-stone-400 ml-4 tracking-widest">Observações do Pedido</label>
                        <textarea
                            placeholder="Ex: Tirar cebola, ponto da carne, etc..."
                            value={customerInfo.observations}
                            onChange={e => setCustomerInfo((prev: any) => ({ ...prev, observations: e.target.value }))}
                            rows={2}
                            className="w-full mt-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:border-orange-500 outline-none font-medium resize-none"
                        />
                    </div>
                </div>

                <div className="pt-6 mt-6 border-t border-stone-100">
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-widest">
                            <span>Subtotal:</span>
                            <span>R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-widest">
                            <span>Entrega:</span>
                            <span>{selectedNeighborhoodFee > 0 ? `R$ ${selectedNeighborhoodFee.toFixed(2)}` : 'Grátis'}</span>
                        </div>
                        <div className="flex justify-between text-3xl font-black text-stone-900 pt-4 border-t border-dashed border-stone-200">
                            <span className="text-xl">TOTAL:</span>
                            <span className="text-orange-600">R$ {total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        onClick={onCheckout}
                        disabled={cart.length === 0 || !isBusinessOpen || isProcessing}
                        className={`w-full py-6 rounded-[2rem] font-black shadow-2xl transition-all flex items-center justify-center gap-4 text-lg ${cart.length === 0 || !isBusinessOpen || isProcessing ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 hover:-translate-y-1'
                            }`}
                    >
                        {isProcessing ? (
                            <i className="fas fa-spinner animate-spin text-2xl"></i>
                        ) : (
                            <i className="fab fa-whatsapp text-2xl"></i>
                        )}
                        {isProcessing ? 'PROCESSANDO...' : isBusinessOpen ? 'FECHAR PEDIDO' : 'FORA DE HORÁRIO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CartSection;
