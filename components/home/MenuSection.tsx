import React from 'react';
import { Marmita } from '../../types';
import Skeleton from '../ui/Skeleton';

interface MenuSectionProps {
    filteredMenu: Marmita[];
    isBusinessOpen: boolean;
    onAddToCart: (marmita: Marmita) => void;
    loading?: boolean;
}

const MenuSection: React.FC<MenuSectionProps> = ({ filteredMenu, isBusinessOpen, onAddToCart, loading }) => {
    if (loading) {
        return (
            <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-10 w-2 bg-stone-100 rounded-full"></div>
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 space-y-6">
                            <Skeleton className="w-full h-48 rounded-[2rem]" />
                            <div className="flex justify-between items-start">
                                <Skeleton className="w-24 h-6 rounded-full" />
                                <Skeleton className="w-16 h-8" />
                            </div>
                            <Skeleton className="w-3/4 h-8" />
                            <div className="space-y-2">
                                <Skeleton className="w-full h-4" />
                                <Skeleton className="w-5/6 h-4" />
                            </div>
                            <Skeleton className="w-full h-16 rounded-2xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
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
                        <div key={marmita.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-2xl transition-all group relative overflow-hidden">
                            {marmita.imageUrl && (
                                <div className="w-full h-48 mb-6 rounded-[2rem] overflow-hidden shadow-md">
                                    <img src={marmita.imageUrl} alt={marmita.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                </div>
                            )}
                            <div className="relative z-10 flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">{marmita.category}</span>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-stone-400 font-bold uppercase mb-1">Preço</span>
                                        <span className="font-black text-3xl text-stone-900">R$ {marmita.price.toFixed(2)}</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-stone-900 mb-2 group-hover:text-orange-600 transition-colors">{marmita.name}</h3>
                                {marmita.prepTime && (
                                    <div className="flex items-center gap-2 mb-3 text-stone-400">
                                        <i className="fas fa-clock text-orange-500"></i>
                                        <span className="text-xs font-black uppercase tracking-widest">{marmita.prepTime}</span>
                                    </div>
                                )}
                                <p className="text-stone-500 text-sm mb-8 leading-relaxed min-h-[3rem]">{marmita.description}</p>
                            </div>
                            <button
                                onClick={() => onAddToCart(marmita)}
                                disabled={!isBusinessOpen}
                                className={`w-full py-5 rounded-2xl font-black transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-3 ${isBusinessOpen ? 'bg-stone-900 text-white hover:bg-orange-600' : 'bg-stone-100 text-stone-300 cursor-not-allowed shadow-none'
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
    );
};

export default MenuSection;
