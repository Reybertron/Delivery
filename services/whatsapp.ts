import { Order, AppConfig } from '../types';

/**
 * Generates a WhatsApp link for the given order using the provided business configuration.
 * Always use the provided config object to access business name and WhatsApp number.
 */
export const generateWhatsAppLink = (order: Order, config: AppConfig): string => {
  const itemsText = order.items
    .map(item => `• *${item.quantity}x ${item.marmita.name}* - R$ ${(item.marmita.price * item.quantity).toFixed(2)}`)
    .join('%0A');

  const deliveryInfo = order.deliveryMethod === 'Retirada' 
    ? `*Tipo:* RETIRADA NO LOCAL`
    : `*Tipo:* ENTREGA%0A*Endereço:* ${order.customerAddress}%0A*Bairro:* ${order.neighborhood}`;

  // Fix: use config.businessName directly as config is now of type AppConfig
  const text = `*NOVO PEDIDO - ${config.businessName.toUpperCase()}*%0A%0A` +
    `*Status Inicial:* Pendente%0A` +
    `*Cliente:* ${order.customerName}%0A` +
    `*Telefone:* ${order.customerPhone}%0A` +
    `${deliveryInfo}%0A` +
    `*Pagamento:* ${order.paymentMethod}%0A%0A` +
    `*Itens:*%0A${itemsText}%0A%0A` +
    `*Subtotal:* R$ ${order.subtotal.toFixed(2)}%0A` +
    `*Taxa:* R$ ${order.deliveryFee.toFixed(2)}%0A` +
    `*TOTAL:* R$ ${order.total.toFixed(2)}%0A%0A` +
    `_Pedido gerado via App_`;

  // Fix: use config.businessWhatsApp directly
  return `https://wa.me/${config.businessWhatsApp}?text=${text}`;
};