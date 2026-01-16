
import { Marmita, Neighborhood, Customer, Order, AppConfig, OrderStatus } from '../types';
import { supabase } from '../lib/supabase';

export const db = {
  // CONFIGURAÇÕES
  getConfig: async (): Promise<AppConfig> => {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .single();

    if (error) {
      // Se não encontrar, retorna padrão (fallback compatível com comportamento anterior)
      if (error.code === 'PGRST116') {
        return {
          businessName: 'Panelas da Vanda',
          businessWhatsApp: '5511999999999',
          autoSaveCustomer: true,
          logoUrl: '',
          adminPassword: '',
          openingTime: '08:00',
          closingTime: '14:00'
        } as any;
      }
      throw error;
    }

    // Mapeando campos do banco para o tipo AppConfig
    return {
      businessWhatsApp: data.whatsapp_negocio,
      businessName: data.nome_negocio,
      autoSaveCustomer: data.salvar_cliente_auto,
      logoUrl: data.url_logo,
      adminPassword: data.senha_admin,
      openingTime: data.horario_abertura,
      closingTime: data.horario_fechamento
    };
  },

  saveConfig: async (config: AppConfig) => {
    // Apaga anterior (comportamento original do server.js era DELETE ALL e INSERT)
    // No Supabase é melhor fazer UPSERT se tivermos um ID fixo, mas mantendo a lógica simples:

    // Primeiro verifica se já existe
    const { data: existing } = await supabase.from('configuracoes').select('id').single();

    const payload = {
      whatsapp_negocio: config.businessWhatsApp,
      nome_negocio: config.businessName,
      salvar_cliente_auto: config.autoSaveCustomer,
      url_logo: config.logoUrl,
      senha_admin: config.adminPassword,
      horario_abertura: config.openingTime || '08:00',
      horario_fechamento: config.closingTime || '14:00'
    };

    if (existing) {
      const { error } = await supabase
        .from('configuracoes')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('configuracoes')
        .insert([payload]);
      if (error) throw error;
    }

    return { success: true };
  },

  // MARMITAS (MENU)
  getMenu: async (): Promise<Marmita[]> => {
    const { data, error } = await supabase
      .from('marmitas')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    return data.map((r: any) => ({
      id: r.id.toString(),
      name: r.nome,
      description: r.descricao,
      price: parseFloat(r.preco),
      day: r.dia_semana,
      category: r.categoria
    }));
  },

  saveMarmita: async (marmita: Omit<Marmita, 'id'>) => {
    const { data, error } = await supabase
      .from('marmitas')
      .insert([{
        nome: marmita.name,
        descricao: marmita.description,
        preco: marmita.price,
        dia_semana: marmita.day,
        categoria: marmita.category
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  updateMarmita: async (id: string, marmita: Omit<Marmita, 'id'>) => {
    const { error } = await supabase
      .from('marmitas')
      .update({
        nome: marmita.name,
        descricao: marmita.description,
        preco: marmita.price,
        dia_semana: marmita.day,
        categoria: marmita.category
      })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  deleteMarmita: async (id: string) => {
    const { error } = await supabase.from('marmitas').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // BAIRROS
  getBairros: async (): Promise<Neighborhood[]> => {
    const { data, error } = await supabase
      .from('bairros')
      .select('*')
      .order('nome');

    if (error) throw error;
    return data.map((r: any) => ({
      name: r.nome,
      deliveryFee: parseFloat(r.taxa_entrega)
    }));
  },

  saveBairro: async (bairro: Neighborhood) => {
    const { error } = await supabase
      .from('bairros')
      .upsert({
        nome: bairro.name,
        taxa_entrega: bairro.deliveryFee
      }, { onConflict: 'nome' });

    if (error) throw error;
    return { success: true };
  },

  deleteBairro: async (name: string) => {
    const { error } = await supabase.from('bairros').delete().eq('nome', name);
    if (error) throw error;
    return { success: true };
  },

  // CLIENTES
  getCustomer: async (phone: string): Promise<Customer | null> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      phone: data.telefone,
      name: data.nome,
      cep: data.cep,
      street: data.rua,
      number: data.numero,
      complement: data.complemento,
      neighborhood: data.bairro
    };
  },

  saveCustomer: async (customer: Customer) => {
    const { error } = await supabase
      .from('clientes')
      .upsert({
        telefone: customer.phone,
        nome: customer.name,
        cep: customer.cep,
        rua: customer.street,
        numero: customer.number,
        complemento: customer.complement,
        bairro: customer.neighborhood
      }, { onConflict: 'telefone' });

    if (error) throw error;
    return { success: true };
  },

  getAllCustomers: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (error) throw error;
    return data.map((r: any) => ({
      phone: r.telefone,
      name: r.nome,
      cep: r.cep,
      street: r.rua,
      number: r.numero,
      complement: r.complemento,
      neighborhood: r.bairro
    }));
  },

  // PEDIDOS
  saveOrder: async (order: Order) => {
    const { error } = await supabase
      .from('pedidos')
      .insert([{
        id: order.id,
        telefone_cliente: order.customerPhone,
        nome_cliente: order.customerName,
        endereco_completo: order.customerAddress,
        bairro: order.neighborhood,
        metodo_entrega: order.deliveryMethod,
        taxa_entrega: order.deliveryFee,
        metodo_pagamento: order.paymentMethod,
        subtotal: order.subtotal,
        total: order.total,
        status: order.status,
        itens: order.items,
        criado_em: order.createdAt || new Date().toISOString()
      }]);

    if (error) throw error;
    return { success: true };
  },

  getOrders: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data.map((r: any) => ({
      id: r.id,
      customerPhone: r.telefone_cliente,
      customerName: r.nome_cliente,
      customerAddress: r.endereco_completo,
      neighborhood: r.bairro,
      deliveryMethod: r.metodo_entrega,
      deliveryFee: parseFloat(r.taxa_entrega),
      paymentMethod: r.metodo_pagamento,
      subtotal: parseFloat(r.subtotal),
      total: parseFloat(r.total),
      status: r.status,
      createdAt: r.criado_em,
      items: r.itens
    }));
  },

  getLatestOrder: async (phone: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('telefone_cliente', phone)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      id: data.id,
      customerPhone: data.telefone_cliente,
      customerName: data.nome_cliente,
      customerAddress: data.endereco_completo,
      neighborhood: data.bairro,
      deliveryMethod: data.metodo_entrega,
      deliveryFee: parseFloat(data.taxa_entrega),
      paymentMethod: data.metodo_pagamento,
      subtotal: parseFloat(data.subtotal),
      total: parseFloat(data.total),
      status: data.status,
      createdAt: data.criado_em,
      items: data.itens
    };
  },

  updateOrderStatus: async (id: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  // Backup temporariamente desabilitado ou reimplementar se necessário
  exportBackup: async () => { console.warn("Backup via Supabase não implementado via API"); return { message: "Use o dashboard do Supabase" }; },
  importBackup: async () => { console.warn("Restore via Supabase não implementado via API"); return { success: false }; }
};
