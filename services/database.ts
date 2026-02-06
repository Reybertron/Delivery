
import { Marmita, Neighborhood, Customer, Order, AppConfig, OrderStatus, CashMovement, Deliverer, Opcional, GrupoOpcional } from '../types';
import { supabase } from '../lib/supabase';

export const db = {
  // MERCADO PAGO
  checkoutMercadoPago: async (orderData: any) => {
    const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
      body: orderData
    });
    if (error) throw error;
    return data;
  },

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
          businessWhatsApp: '73982298750',
          autoSaveCustomer: true,
          logoUrl: '',
          adminPassword: '',
          openingTime: '08:00',
          closingTime: '14:00',
          autoPrint: false,
          printerName: '',
          printMode: 'PDF + Impressão',
          hasAdminPassword: true
        };
      }
      throw error;
    }

    // Mapeando campos do banco para o tipo AppConfig
    return {
      businessWhatsApp: data.whatsapp_negocio,
      businessName: data.nome_negocio,
      autoSaveCustomer: data.salvar_cliente_auto,
      logoUrl: data.url_logo,
      adminPassword: '', // Não retornamos mais a senha por segurança
      openingTime: data.horario_abertura,
      closingTime: data.horario_fechamento,
      autoPrint: data.auto_print,
      printerName: data.printer_name,
      printMode: data.print_mode || 'PDF + Impressão',
      mercadoPagoEnabled: data.mercadopago_ativo,
      mercadoPagoPublicKey: data.mercadopago_token_publico,
      hasAdminPassword: data.senha_admin !== null && data.senha_admin !== undefined && data.senha_admin !== '',
      instagramUrl: data.url_instagram,
      facebookUrl: data.url_facebook
    };
  },

  verifyAdminPassword: async (password: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('senha_admin', password)
      .single();

    if (error || !data) return false;
    return true;
  },

  saveConfig: async (config: AppConfig) => {
    // Apaga anterior (comportamento original do server.js era DELETE ALL e INSERT)
    // No Supabase é melhor fazer UPSERT se tivermos um ID fixo, mas mantendo a lógica simples:

    // Primeiro verifica se já existe
    const { data: existing } = await supabase.from('configuracoes').select('id').single();

    const payload: any = {
      whatsapp_negocio: config.businessWhatsApp,
      nome_negocio: config.businessName,
      salvar_cliente_auto: config.autoSaveCustomer,
      url_logo: config.logoUrl,
      horario_abertura: config.openingTime || '08:00',
      horario_fechamento: config.closingTime || '14:00',
      auto_print: config.autoPrint,
      printer_name: config.printerName,
      print_mode: config.printMode || 'PDF + Impressão',
      mercadopago_ativo: config.mercadoPagoEnabled || false,
      mercadopago_token_publico: config.mercadoPagoPublicKey || '',
      url_instagram: config.instagramUrl || '',
      url_facebook: config.facebookUrl || ''
    };

    if (config.adminPassword) {
      payload.senha_admin = config.adminPassword;
    }

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
      .select(`
        *,
        marmitas_grupos(
          grupos_opcionais(
            *,
            opcionais(*)
          )
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error("Erro ao buscar menu:", error);
      throw error;
    }

    console.log("Dados brutos do banco:", data);

    return data.map((r: any) => ({
      id: r.id.toString(),
      name: r.nome,
      description: r.descricao,
      price: parseFloat(r.preco),
      day: r.dia_semana,
      category: r.categoria,
      imageUrl: r.imagem_url,
      prepTime: r.tempo_preparo,
      available: r.disponivel !== false,
      gruposOpcionais: r.marmitas_grupos?.map((mg: any) => {
        if (!mg.grupos_opcionais) return null;
        return {
          id: mg.grupos_opcionais.id.toString(),
          nome: mg.grupos_opcionais.nome,
          minSelecao: mg.grupos_opcionais.min_selecao,
          maxSelecao: mg.grupos_opcionais.max_selecao,
          opcionais: mg.grupos_opcionais.opcionais?.map((opt: any) => ({
            id: opt.id.toString(),
            nome: opt.nome,
            precoAdicional: parseFloat(opt.preco_adicional),
            disponivel: opt.disponivel,
            imageUrl: opt.imagem_url
          })) || []
        };
      }).filter(Boolean) || []
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
        categoria: marmita.category,
        imagem_url: marmita.imageUrl,
        tempo_preparo: marmita.prepTime,
        disponivel: marmita.available
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
        categoria: marmita.category,
        imagem_url: marmita.imageUrl,
        tempo_preparo: marmita.prepTime,
        disponivel: marmita.available
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

  // --- NOVAS FUNÇÕES PARA OPCIONAIS ---
  getGruposOpcionais: async (): Promise<GrupoOpcional[]> => {
    const { data, error } = await supabase
      .from('grupos_opcionais')
      .select('*, opcionais(*)');
    if (error) throw error;
    return data.map((g: any) => ({
      id: g.id.toString(),
      nome: g.nome,
      minSelecao: g.min_selecao,
      maxSelecao: g.max_selecao,
      opcionais: (g.opcionais || []).map((o: any) => ({
        id: o.id.toString(),
        nome: o.nome,
        precoAdicional: parseFloat(o.preco_adicional || 0),
        disponivel: o.disponivel !== false,
        imageUrl: o.imagem_url,
        gerenciarEstoque: o.gerenciar_estoque || false,
        estoqueAtual: o.estoque_atual || 0
      }))
    }));
  },

  saveGrupoOpcional: async (grupo: Omit<GrupoOpcional, 'id' | 'opcionais'>) => {
    const { data, error } = await supabase
      .from('grupos_opcionais')
      .insert([{
        nome: grupo.nome,
        min_selecao: grupo.minSelecao,
        max_selecao: grupo.maxSelecao
      }])
      .select();
    if (error) throw error;
    return data[0];
  },

  updateGrupoOpcional: async (id: string, grupo: Omit<GrupoOpcional, 'id' | 'opcionais'>) => {
    const { error } = await supabase
      .from('grupos_opcionais')
      .update({
        nome: grupo.nome,
        min_selecao: grupo.minSelecao,
        max_selecao: grupo.maxSelecao
      })
      .eq('id', id);
    if (error) throw error;
  },

  deleteGrupoOpcional: async (id: string) => {
    const { error } = await supabase.from('grupos_opcionais').delete().eq('id', id);
    if (error) throw error;
  },

  saveOpcional: async (grupoId: string, opcional: Omit<Opcional, 'id'>) => {
    const { error } = await supabase
      .from('opcionais')
      .insert([{
        grupo_id: grupoId,
        nome: opcional.nome,
        preco_adicional: opcional.precoAdicional,
        disponivel: opcional.disponivel,
        imagem_url: opcional.imageUrl,
        gerenciar_estoque: opcional.gerenciarEstoque || false,
        estoque_atual: opcional.estoqueAtual || 0
      }]);
    if (error) throw error;
  },

  updateOpcional: async (id: string, opcional: Omit<Opcional, 'id'>) => {
    const { error } = await supabase
      .from('opcionais')
      .update({
        nome: opcional.nome,
        preco_adicional: opcional.precoAdicional,
        disponivel: opcional.disponivel,
        imagem_url: opcional.imageUrl,
        gerenciar_estoque: opcional.gerenciarEstoque || false,
        estoque_atual: opcional.estoqueAtual || 0
      })
      .eq('id', id);
    if (error) throw error;
  },

  deleteOpcional: async (id: string) => {
    const { error } = await supabase.from('opcionais').delete().eq('id', id);
    if (error) throw error;
  },

  vincularGrupoMarmita: async (marmitaId: string, grupoId: string) => {
    const { error } = await supabase
      .from('marmitas_grupos')
      .insert([{ marmita_id: marmitaId, grupo_id: grupoId }]);
    if (error) throw error;
  },

  desvincularGrupoMarmita: async (marmitaId: string, grupoId: string) => {
    const { error } = await supabase
      .from('marmitas_grupos')
      .delete()
      .eq('marmita_id', marmitaId)
      .eq('grupo_id', grupoId);
    if (error) throw error;
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
        observacoes: order.observations,
        criado_em: order.createdAt || new Date().toISOString()
      }]);

    if (error) throw error;

    // Baixa de estoque manual para opcionais
    for (const item of order.items) {
      if (item.selectedOptionals) {
        for (const opt of item.selectedOptionals) {
          if (opt.gerenciarEstoque) {
            const { data: currentOpt } = await supabase
              .from('opcionais')
              .select('estoque_atual')
              .eq('id', opt.id)
              .single();

            if (currentOpt) {
              const novoEstoque = Math.max(0, (currentOpt.estoque_atual || 0) - item.quantity);
              await supabase
                .from('opcionais')
                .update({
                  estoque_atual: novoEstoque,
                  disponivel: novoEstoque > 0
                })
                .eq('id', opt.id);
            }
          }
        }
      }
    }

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
      items: typeof r.itens === 'string' ? JSON.parse(r.itens) : r.itens,
      observations: r.observacoes,
      delivererId: r.entregador_id,
      delivererName: r.entregador_nome,
      assignedAt: r.atribuido_em,
      deliveredAt: r.entregue_em,
      estimatedTime: r.tempo_estimado
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
      items: typeof data.itens === 'string' ? JSON.parse(data.itens) : data.itens,
      observations: data.observacoes,
      delivererId: data.entregador_id,
      delivererName: data.entregador_nome
    };
  },

  updateOrderStatus: async (id: string, status: OrderStatus) => {
    // Se for cancelado, repõe o estoque
    if (status === 'Cancelado') {
      const { data: order } = await supabase.from('pedidos').select('itens').eq('id', id).single();
      if (order && order.itens) {
        const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        for (const item of itens) {
          if (item.selectedOptionals) {
            for (const opt of item.selectedOptionals) {
              if (opt.gerenciarEstoque) {
                const { data: currentOpt } = await supabase
                  .from('opcionais')
                  .select('estoque_atual')
                  .eq('id', opt.id)
                  .single();

                if (currentOpt) {
                  const novoEstoque = (currentOpt.estoque_atual || 0) + item.quantity;
                  await supabase
                    .from('opcionais')
                    .update({
                      estoque_atual: novoEstoque,
                      disponivel: true // Sempre reativa se houver estoque
                    })
                    .eq('id', opt.id);
                }
              }
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from('pedidos')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  // FLUXO DE CAIXA
  getCashMovements: async (date: string): Promise<CashMovement[]> => {
    const { data, error } = await supabase
      .from('fluxo_caixa')
      .select('*')
      .gte('criado_em', `${date}T00:00:00Z`)
      .lte('criado_em', `${date}T23:59:59Z`)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      tipo: d.tipo,
      categoria: d.categoria,
      descricao: d.descricao,
      valor: d.valor,
      criado_em: d.criado_em
    }));
  },

  addCashMovement: async (movement: Omit<CashMovement, 'id' | 'criado_em'>) => {
    const { error } = await supabase
      .from('fluxo_caixa')
      .insert([movement]);
    if (error) throw error;
    return { success: true };
  },

  deleteCashMovement: async (id: string) => {
    const { error } = await supabase
      .from('fluxo_caixa')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ENTREGADORES
  getDeliverers: async (): Promise<Deliverer[]> => {
    const { data, error } = await supabase
      .from('entregadores')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;

    return (data || []).map((r: any) => ({
      id: r.id,
      name: r.nome,
      phone: r.telefone,
      cpf: r.cpf,
      vehicleType: r.tipo_veiculo,
      vehicleModel: r.modelo_veiculo,
      vehiclePlate: r.placa_veiculo,
      vehicleColor: r.cor_veiculo,
      status: r.status,
      maxOrders: r.max_pedidos,
      rating: r.avaliacao ? parseFloat(r.avaliacao) : undefined,
      totalDeliveries: r.total_entregas,
      photoUrl: r.foto_url,
      createdAt: r.criado_em,
      isActive: r.ativo,
      password: r.senha,
      lastLogin: r.ultimo_login
    }));
  },

  saveDeliverer: async (deliverer: Omit<Deliverer, 'id' | 'createdAt' | 'totalDeliveries' | 'rating'>) => {
    const payload = {
      nome: deliverer.name,
      telefone: deliverer.phone,
      cpf: deliverer.cpf,
      tipo_veiculo: deliverer.vehicleType,
      modelo_veiculo: deliverer.vehicleModel,
      placa_veiculo: deliverer.vehiclePlate,
      cor_veiculo: deliverer.vehicleColor,
      status: deliverer.status,
      max_pedidos: deliverer.maxOrders,
      foto_url: deliverer.photoUrl,
      ativo: deliverer.isActive,
      senha: deliverer.password
    };

    const { error } = await supabase
      .from('entregadores')
      .insert([payload]);

    if (error) throw error;
    return { success: true };
  },

  updateDeliverer: async (id: string, deliverer: Partial<Deliverer>) => {
    const payload: any = {};
    if (deliverer.name) payload.nome = deliverer.name;
    if (deliverer.phone) payload.telefone = deliverer.phone;
    if (deliverer.vehicleType) payload.tipo_veiculo = deliverer.vehicleType;
    if (deliverer.vehicleModel) payload.modelo_veiculo = deliverer.vehicleModel;
    if (deliverer.vehiclePlate) payload.placa_veiculo = deliverer.vehiclePlate;
    if (deliverer.vehicleColor !== undefined) payload.cor_veiculo = deliverer.vehicleColor;
    if (deliverer.status) payload.status = deliverer.status;
    if (deliverer.maxOrders) payload.max_pedidos = deliverer.maxOrders;
    if (deliverer.photoUrl !== undefined) payload.foto_url = deliverer.photoUrl;
    if (deliverer.isActive !== undefined) payload.ativo = deliverer.isActive;
    if (deliverer.password !== undefined) payload.senha = deliverer.password;
    if (deliverer.lastLogin !== undefined) payload.ultimo_login = deliverer.lastLogin;

    const { error } = await supabase
      .from('entregadores')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  deleteDeliverer: async (id: string) => {
    // Soft delete
    const { error } = await supabase
      .from('entregadores')
      .update({ ativo: false, status: 'Offline' })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  assignDeliverer: async (orderId: string, delivererId: string, delivererName: string) => {
    const { error } = await supabase
      .from('pedidos')
      .update({
        entregador_id: delivererId,
        entregador_nome: delivererName,
        atribuido_em: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  },

  getDelivererOrders: async (delivererId: string): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('entregador_id', delivererId)
      .in('status', ['Entrega', 'Preparo'])
      .order('criado_em', { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => ({
      id: r.id,
      customerPhone: r.telefone_cliente,
      customerName: r.nome_cliente,
      customerAddress: r.endereco_completo,
      neighborhood: r.bairro,
      deliveryMethod: r.metodo_entrega,
      deliveryFee: parseFloat(r.taxa_entrega),
      paymentMethod: r.metodo_pagamento,
      items: typeof r.itens === 'string' ? JSON.parse(r.itens) : r.itens,
      subtotal: parseFloat(r.subtotal),
      total: parseFloat(r.total),
      status: r.status,
      createdAt: r.criado_em,
      observations: r.observacoes,
      delivererId: r.entregador_id,
      delivererName: r.entregador_nome,
      assignedAt: r.atribuido_em,
      deliveredAt: r.entregue_em,
      estimatedTime: r.tempo_estimado
    }));
  },

  loginDeliverer: async (phone: string, password: string): Promise<Deliverer | null> => {
    const { data, error } = await supabase
      .from('entregadores')
      .select('*')
      .eq('telefone', phone)
      .eq('senha', password)
      .eq('ativo', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const deliverer: Deliverer = {
      id: data.id,
      name: data.nome,
      phone: data.telefone,
      cpf: data.cpf,
      vehicleType: data.tipo_veiculo,
      vehicleModel: data.modelo_veiculo,
      vehiclePlate: data.placa_veiculo,
      vehicleColor: data.cor_veiculo,
      status: data.status,
      maxOrders: data.max_pedidos,
      rating: data.avaliacao ? parseFloat(data.avaliacao) : undefined,
      totalDeliveries: data.total_entregas,
      photoUrl: data.foto_url,
      createdAt: data.criado_em,
      isActive: data.ativo,
      password: data.senha,
      lastLogin: data.ultimo_login
    };

    // Atualiza o último login
    await db.updateDeliverer(deliverer.id, { lastLogin: new Date().toISOString() });

    return deliverer;
  },

  // BACKUP E MARKETING
  saveMarketingPoster: async (base64Image: string) => {
    const { data, error } = await supabase
      .from('marketing_posters')
      .insert([{ image_data: base64Image }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getLatestMarketingPoster: async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('marketing_posters')
      .select('image_data')
      .order('criado_em', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].image_data;
  },

  exportBackup: async () => { console.warn("Backup via Supabase não implementado via API"); return { message: "Use o dashboard do Supabase" }; },
  importBackup: async () => { console.warn("Restore via Supabase não implementado via API"); return { success: false }; }
};
