
import { Marmita, DayOfWeek, Neighborhood } from './types';

export const WHATSAPP_PHONE = '5511999999999';

export const INITIAL_NEIGHBORHOODS: Neighborhood[] = [
  { name: 'Centro', deliveryFee: 5.0 },
  { name: 'Vila Nova', deliveryFee: 7.0 },
  { name: 'Jardim América', deliveryFee: 8.5 },
  { name: 'Industrial', deliveryFee: 10.0 },
  { name: 'Retirada no Local', deliveryFee: 0.0 },
];

export const INITIAL_MENU: Marmita[] = [
  { id: '1', name: 'Feijoada Completa', description: 'Arroz, couve, farofa e laranja', price: 25.0, day: DayOfWeek.WEDNESDAY, category: 'Executiva' },
  { id: '2', name: 'Virado à Paulista', description: 'Tutu de feijão, arroz, couve e ovo', price: 22.0, day: DayOfWeek.MONDAY, category: 'Executiva' },
  { id: '3', name: 'Bife à Parmegiana', description: 'Acompanha arroz e batata frita', price: 28.0, day: DayOfWeek.THURSDAY, category: 'Executiva' },
  { id: '4', name: 'Peixe Grelhado', description: 'Filé de tilápia com legumes no vapor', price: 24.0, day: DayOfWeek.FRIDAY, category: 'Executiva' },
  { id: '5', name: 'Frango Assado', description: 'Arroz, feijão e maionese caseira', price: 20.0, day: DayOfWeek.SUNDAY, category: 'Executiva' },
  { id: '6', name: 'Marmita Econômica', description: 'Arroz, feijão e omelete', price: 15.0, day: DayOfWeek.MONDAY, category: 'Pequena' },
];

export const DAYS_LIST: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];
