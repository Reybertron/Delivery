import React from 'react';
import { Marmita, Opcional } from '../../types';

interface OptionalsModalProps {
    show: boolean;
    marmita: Marmita | null;
    selections: { [groupId: string]: Opcional[] };
    setSelections: React.Dispatch<React.SetStateAction<{ [groupId: string]: Opcional[] }>>;
    onClose: () => void;
    onConfirm: (marmita: Marmita, allSelected: Opcional[]) => void;
}

const OptionalsModal: React.FC<OptionalsModalProps> = ({
    show,
    marmita,
    selections,
    setSelections,
    onClose,
    onConfirm
}) => {
    if (!show || !marmita) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4 bg-stone-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-black text-stone-900 leading-none mb-1">{marmita.name}</h3>
                        <p className="text-orange-600 font-bold text-xs uppercase tracking-widest">Personalize seu pedido</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-red-500 transition-all"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
                    {marmita.gruposOpcionais?.map(grupo => (
                        <div key={grupo.id} className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h4 className="font-black text-stone-800 uppercase tracking-tighter text-lg">{grupo.nome}</h4>
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                        {grupo.minSelecao > 0 ? `Obrigatório • Selecione ${grupo.minSelecao}` : 'Opcional'}
                                        {grupo.maxSelecao > 1 ? ` • Máximo ${grupo.maxSelecao}` : (grupo.maxSelecao === 1 ? ' • Escolha 1' : '')}
                                    </p>
                                </div>
                                {grupo.minSelecao > 0 && !(selections[grupo.id]?.length >= grupo.minSelecao) && (
                                    <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-2 py-1 rounded-md uppercase">Obrigatório</span>
                                )}
                            </div>

                            <div className="space-y-3">
                                {grupo.opcionais.map(opcional => {
                                    const isSelected = selections[grupo.id]?.some(s => s.id === opcional.id);
                                    const isOutOfStock = opcional.gerenciarEstoque && (opcional.estoqueAtual || 0) <= 0;
                                    const isDisabled = !opcional.disponivel || isOutOfStock;

                                    return (
                                        <button
                                            key={opcional.id}
                                            disabled={isDisabled}
                                            onClick={() => {
                                                setSelections(prev => {
                                                    const current = prev[grupo.id] || [];
                                                    let next: Opcional[];

                                                    if (isSelected) {
                                                        next = current.filter(s => s.id !== opcional.id);
                                                    } else {
                                                        if (grupo.maxSelecao === 1) {
                                                            next = [opcional];
                                                        } else if (grupo.maxSelecao > 0 && current.length < grupo.maxSelecao) {
                                                            next = [...current, opcional];
                                                        } else if (grupo.maxSelecao > 0) {
                                                            alert(`Limite atingido! Você só pode escolher ${grupo.maxSelecao} item(ns) neste grupo.`);
                                                            return prev;
                                                        } else {
                                                            next = [...current, opcional];
                                                        }
                                                    }
                                                    return { ...prev, [grupo.id]: next };
                                                });
                                            }}
                                            className={`w-full flex justify-between items-center p-5 rounded-2xl border-2 transition-all ${isSelected ? 'border-orange-500 bg-orange-50/50 shadow-md' : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                                                } ${!opcional.disponivel ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {opcional.imageUrl && (
                                                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm border border-stone-100 flex-shrink-0">
                                                        <img src={opcional.imageUrl} alt={opcional.nome} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="text-left">
                                                    <p className={`font-bold transition-colors ${isSelected ? 'text-orange-700 font-black' : 'text-stone-700'}`}>{opcional.nome}</p>
                                                    <div className="flex items-center gap-2">
                                                        {opcional.precoAdicional > 0 && <p className="text-xs font-black text-orange-600">+ R$ {opcional.precoAdicional.toFixed(2)}</p>}
                                                        {isOutOfStock && <span className="text-[8px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-md uppercase">Esgotado</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-orange-500 border-orange-500 text-white animate-bounce-short' : (isDisabled ? 'bg-stone-50 border-stone-100' : 'bg-white border-stone-200')
                                                }`}>
                                                {isSelected && <i className="fas fa-check text-[10px]"></i>}
                                                {isOutOfStock && <i className="fas fa-times text-[10px] text-red-300"></i>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 bg-stone-50 border-t border-stone-100">
                    <button
                        disabled={marmita.gruposOpcionais?.some(g => (selections[g.id]?.length || 0) < g.minSelecao)}
                        onClick={() => {
                            const allSelected = Object.values(selections).flat();
                            onConfirm(marmita, allSelected);
                        }}
                        className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-lg"
                    >
                        ADICIONAR AO PEDIDO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OptionalsModal;
