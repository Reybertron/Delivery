import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = !isNative;

/**
 * Hook ou utilitário para garantir que o Admin não seja acessível se estivermos em mobile nativo,
 * a menos que seja explicitamente permitido (ex: via uma flag no banco ou env).
 */
export const isMobileAccessAllowed = () => {
    // Por padrão, bloqueamos admin em apps nativos para clientes (segurança extra)
    return !isNative;
};
