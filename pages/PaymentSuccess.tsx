
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const PaymentSuccess: React.FC = () => {
    useEffect(() => {
        // Você pode adicionar lógica aqui para limpar o carrinho se não foi limpo
        // ou buscar o status mais recente do pedido
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-fade-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8 shadow-inner">
                <i className="fas fa-check text-4xl text-green-500"></i>
            </div>

            <h1 className="text-3xl font-black text-stone-800 mb-2 uppercase tracking-tight">
                Pagamento Aprovado!
            </h1>

            <p className="text-stone-500 mb-8 max-w-sm">
                Seu pedido já foi recebido pela nossa cozinha e está sendo preparado com muito carinho.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Link
                    to="/"
                    className="bg-green-500 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-green-100 hover:bg-green-600 transition-all hover:-translate-y-1"
                >
                    Voltar para o Início
                </Link>

                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                    Você pode acompanhar o status na aba de acompanhamento.
                </p>
            </div>
        </div>
    );
};

export default PaymentSuccess;
