
export enum DayOfWeek {
  MONDAY = 'Segunda-feira',
  TUESDAY = 'Terça-feira',
  WEDNESDAY = 'Quarta-feira',
  THURSDAY = 'Quinta-feira',
  FRIDAY = 'Sexta-feira',
  SATURDAY = 'Sábado',
  SUNDAY = 'Domingo'
}

export interface Neighborhood {
  name: string;
  deliveryFee: number;
}

export interface Customer {
  phone: string;
  name: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
}

export interface Opcional {
  id: string;
  nome: string;
  precoAdicional: number;
  disponivel: boolean;
}

export interface GrupoOpcional {
  id: string;
  nome: string;
  minSelecao: number;
  maxSelecao: number;
  opcionais: Opcional[];
}

export interface Marmita {
  id: string;
  name: string;
  description: string;
  price: number;
  day: DayOfWeek;
  category: 'Pequena' | 'Média' | 'Grande' | 'Executiva';
  imageUrl?: string;
  prepTime?: string;
  available: boolean;
  gruposOpcionais?: GrupoOpcional[];
}

export interface OrderItem {
  marmita: Marmita;
  quantity: number;
  selectedOptionals?: Opcional[];
}

export type OrderStatus = 'Pendente' | 'Impresso' | 'Preparo' | 'Entrega' | 'Finalizado' | 'Cancelado';
export type DeliveryMethod = 'Entrega' | 'Retirada';

export interface Order {
  id: string;
  customerPhone: string;
  customerName: string;
  customerAddress: string;
  neighborhood: string;
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
  paymentMethod: 'Pix' | 'Cartão' | 'Dinheiro';
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  observations?: string;
  // Campos de Entregador
  delivererId?: string;
  delivererName?: string;
  assignedAt?: string;
  deliveredAt?: string;
  estimatedTime?: number; // minutos
}

export interface AppConfig {
  businessWhatsApp: string;
  businessName: string;
  autoSaveCustomer: boolean;
  logoUrl?: string;
  adminPassword?: string;
  openingTime?: string; // Formato HH:mm
  closingTime?: string; // Formato HH:mm
  autoPrint?: boolean;
  printerName?: string;
  printMode?: 'Apenas PDF' | 'PDF + Impressão';
  mercadoPagoEnabled?: boolean;
  mercadoPagoPublicKey?: string;
}

export interface CashMovement {
  id: string;
  tipo: 'Entrada' | 'Saída';
  categoria: string;
  descricao?: string;
  valor: number;
  criado_em: string;
}

// SISTEMA DE ENTREGADORES
export type VehicleType = 'Moto' | 'Carro' | 'Bicicleta' | 'A pé';
export type DelivererStatus = 'Disponível' | 'Em Rota' | 'Indisponível' | 'Offline';

export interface Deliverer {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleColor?: string;
  status: DelivererStatus;
  maxOrders: number;
  rating?: number;
  totalDeliveries: number;
  photoUrl?: string;
  createdAt: string;
  isActive: boolean;
  password?: string;
  lastLogin?: string;
}
