import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Marmita, DayOfWeek, Neighborhood, Customer, Order, AppConfig, OrderStatus, CashMovement, Deliverer, VehicleType, DelivererStatus, GrupoOpcional, Opcional } from '../types';
import { DAYS_LIST } from '../constants';
import { db } from '../services/database';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';

const modalStyles = `
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .animate-modal-in {
    animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
`;

// O toast agora é gerenciado via estado dentro do componente para permitir UI customizada

type AdminTab = 'pedidos' | 'caixa' | 'menu' | 'bairros' | 'clientes' | 'entregadores' | 'marketing' | 'config';

const Admin: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('pedidos');
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'Online' | 'Offline'>('Offline');

  const [menu, setMenu] = useState<Marmita[]>([]);
  const [bairros, setBairros] = useState<Neighborhood[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);

  // Estados do Livro Caixa
  const [movForm, setMovForm] = useState<Omit<CashMovement, 'id' | 'criado_em'>>({
    tipo: 'Saída', categoria: 'Insumos', descricao: '', valor: 0
  });

  // Inicializa globalDate com a data local no formato YYYY-MM-DD
  const [globalDate, setGlobalDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchOrderPhone, setSearchOrderPhone] = useState('');

  // Estados do Menu
  const [editingMarmita, setEditingMarmita] = useState<Marmita | null>(null);
  const [marmitaForm, setMarmitaForm] = useState<Omit<Marmita, 'id'>>({
    name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '', available: true
  });
  const [menuDayFilter, setMenuDayFilter] = useState<DayOfWeek | 'Todos'>('Todos');

  const [bairroForm, setBairroForm] = useState<Neighborhood>({ name: '', deliveryFee: 0 });
  const [isEditingBairro, setIsEditingBairro] = useState(false);

  // Estados de Cliente
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomerOrders, setViewingCustomerOrders] = useState<Customer | null>(null);

  // Modal de Logo
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [tempLogo, setTempLogo] = useState<string | null>(null);
  const processedOrders = useRef<Set<string>>(new Set());

  // Estados de Marketing
  const [marketingMessage, setMarketingMessage] = useState('');
  const [marketingSentSet, setMarketingSentSet] = useState<Set<string>>(new Set());
  const [marketingNeighborhoodFilter, setMarketingNeighborhoodFilter] = useState('Todos');
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [lastGeneratedPoster, setLastGeneratedPoster] = useState<string | null>(null);

  const currentDayMenu = useMemo(() => {
    const dayIndex = new Date().getDay();
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
    ];
    const today = days[dayIndex];
    return menu.filter(m => m.day === today && m.available);
  }, [menu]);

  // Estados de Entregadores
  const [deliverers, setDeliverers] = useState<Deliverer[]>([]);
  const [delivererForm, setDelivererForm] = useState<Omit<Deliverer, 'id' | 'createdAt' | 'totalDeliveries' | 'rating'>>({
    name: '',
    phone: '',
    cpf: '',
    vehicleType: 'Moto',
    vehicleModel: '',
    vehiclePlate: '',
    vehicleColor: '',
    status: 'Disponível',
    maxOrders: 3,
    photoUrl: '',
    isActive: true,
    password: ''
  });
  const [editingDeliverer, setEditingDeliverer] = useState<Deliverer | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [orderToAssign, setOrderToAssign] = useState<Order | null>(null);

  // Estados de Opcionais
  const [gruposOpcionais, setGruposOpcionais] = useState<GrupoOpcional[]>([]);
  const [showOpcionalModal, setShowOpcionalModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoOpcional | null>(null);
  const [grupoForm, setGrupoForm] = useState<Omit<GrupoOpcional, 'id' | 'opcionais'>>({
    nome: '', minSelecao: 0, maxSelecao: 1
  });

  // Controle de Terminal Local
  const [isLocalPrinter, setIsLocalPrinter] = useState(() => localStorage.getItem('is_local_printer') === 'true');

  const toggleLocalPrinter = (val: boolean) => {
    setIsLocalPrinter(val);
    localStorage.setItem('is_local_printer', val.toString());
    if (val) showToast('Este dispositivo agora é um Terminal de Impressão!');
  };
  const [opcionalForm, setOpcionalForm] = useState<Omit<Opcional, 'id'>>({
    nome: '', precoAdicional: 0, disponivel: true, imageUrl: '', gerenciarEstoque: false, estoqueAtual: 0
  });
  const [isAddingOpcional, setIsAddingOpcional] = useState<string | false>(false);
  const [editingOpcional, setEditingOpcional] = useState<Opcional | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [mMenu, mBairros, mConfigs, mDeliverers, mGrupos, mLastPoster] = await Promise.all([
          db.getMenu(),
          db.getBairros(),
          db.getConfig(),
          db.getDeliverers(),
          db.getGruposOpcionais(),
          db.getLatestMarketingPoster()
        ]);
        setMenu(mMenu);
        setBairros(mBairros);
        setConfig(mConfigs);
        setDeliverers(mDeliverers);
        setGruposOpcionais(mGrupos);
        setLastGeneratedPoster(mLastPoster);
        setDbStatus('Online');

        // Template padrão de marketing
        const daysArr: DayOfWeek[] = [
          DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
          DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
        ];
        const currentIdx = new Date().getDay();

        const menuString = mMenu
          .filter(m => m.day === daysArr[currentIdx] && m.available)
          .map(m => `• *${m.name}*`)
          .join('\n');

        setMarketingMessage(
          `Olá *{nome}*! 🍱\n\nConfira o cardápio de hoje na *${mConfigs.businessName || 'Panelas da Vanda'}*:\n\n{cardapio}\n\nFaça seu pedido agora pelo link:\n{link}\n\nBom apetite! 😋`
        );
        // FAIL-SECURE: Only authorize if hasAdminPassword is EXPLICITLY false.
        // If it's true, undefined, or truthy, require password.
        if (mConfigs.hasAdminPassword === false) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (e) {
        console.error("Falha de comunicação com DB");
        setDbStatus('Offline');
      }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      refreshData();
      const interval = setInterval(refreshData, 10000); // Reduzido para 10s para maior agilidade
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  // Lógica de Impressão Automática
  // Lógica de Impressão Automática Reformulada para maior confiabilidade
  useEffect(() => {
    const processAutoPrint = async () => {
      // TRAVA DE SEGURANÇA: Só imprime se a função estiver ligada E este dispositivo for o terminal autorizado
      if (config?.autoPrint && isLocalPrinter && orders.length > 0) {
        const pendingOrders = orders.filter(
          o => o.status === 'Pendente' && !processedOrders.current.has(o.id)
        );

        if (pendingOrders.length > 0) {
          console.log(`Detectados ${pendingOrders.length} novos pedidos para processamento automático.`);

          for (const order of pendingOrders) {
            // Marca como processado na sessão para evitar loops imediatos
            processedOrders.current.add(order.id);

            try {
              // 1. Atualiza o status no Banco e Localmente PRIMEIRO
              // Isso garante que o pedido não seja detectado de novo se a impressão demorar
              console.log(`Atualizando status do pedido ${order.id} para 'Impresso'...`);
              await db.updateOrderStatus(order.id, 'Impresso');

              setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Impresso' } : o));
              console.log(`Status do pedido ${order.id} atualizado com sucesso.`);

              // 2. Agora dispara as ações lentas/bloqueantes
              console.log(`Gerando PDF (Modo: ${config.printMode || 'PDF + Impressão'})...`);

              // Gera o PDF (Download automático)
              try {
                await generatePDF(order);
              } catch (pdfErr) {
                console.error(`Erro ao gerar PDF do pedido ${order.id}:`, pdfErr);
              }

              // Dispara a Impressão (Abre janela) SÓ SE estiver no modo completo
              if (config.printMode !== 'Apenas PDF') {
                printOrder(order);
              }

            } catch (statusErr) {
              console.error(`Falha Crítica ao processar pedido ${order.id}:`, statusErr);
              // Se falhou o update de status, removemos do processedOrders para tentar de novo no próximo ciclo
              processedOrders.current.delete(order.id);
            }
          }
        }
      }
    };

    processAutoPrint();
  }, [orders, config?.autoPrint]);


  const refreshData = async () => {
    try {
      // Usando try/catch individual para não travar o refresh se uma tabela falhar
      const fetchSafe = async (fn: () => Promise<any>, setter: (val: any) => void) => {
        try {
          const data = await fn();
          setter(Array.isArray(data) ? data : data || []);
        } catch (e) { console.error(`Erro ao carregar dados: ${fn.name}`, e); }
      };

      await Promise.all([
        fetchSafe(db.getMenu, setMenu),
        fetchSafe(db.getBairros, setBairros),
        fetchSafe(db.getOrders, setOrders),
        fetchSafe(db.getAllCustomers, setCustomers),
        fetchSafe(db.getDeliverers, setDeliverers),
        fetchSafe(db.getGruposOpcionais, setGruposOpcionais),
        db.getConfig().then(setConfig).catch(() => { }),
        db.getCashMovements(globalDate).then(setMovements).catch(() => { })
      ]);

      setDbStatus('Online');
    } catch (e) {
      console.error("Erro geral na sincronização", e);
      setDbStatus('Offline');
    }
  };

  // Polling para atualização "tempo real"
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 20000); // Atualiza a cada 20 segundos
    return () => clearInterval(interval);
  }, [globalDate]);

  const ordersData = useMemo(() => {
    const daily = orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate));
    const pending = daily.filter(o => o.status === 'Pendente').length;
    const preparing = daily.filter(o => o.status === 'Preparo').length;
    const delivery = daily.filter(o => o.status === 'Entrega').length;
    const finished = daily.filter(o => o.status === 'Finalizado').length;
    return { daily, pending, preparing, delivery, finished };
  }, [orders, globalDate]);

  const caixaData = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const daily = safeOrders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && o.status !== 'Cancelado');

    // Cálculo discriminado
    const totalEntradas = daily.reduce((acc, o) => acc + (o.total || 0), 0);
    const totalTaxas = daily.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
    const totalProdutos = totalEntradas - totalTaxas;

    // Movimentações manuais (Entradas vs Saídas)
    const entradasManuais = movements.filter(m => m.tipo === 'Entrada').reduce((acc, m) => acc + m.valor, 0);
    const saídasManuais = movements.filter(m => m.tipo === 'Saída').reduce((acc, m) => acc + m.valor, 0);

    const saldoReal = totalEntradas + entradasManuais - saídasManuais;

    const count = daily.length;
    const ticketMedio = count > 0 ? totalEntradas / count : 0;

    const sintético = daily.reduce((acc: any, o) => {
      acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.total;
      return acc;
    }, {});

    return {
      total: totalEntradas,
      totalTaxas,
      totalProdutos,
      entradasManuais,
      saídasManuais,
      saldoReal,
      count,
      ticketMedio,
      sintético,
      dailyOrders: daily
    };
  }, [orders, globalDate, movements]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (existing code snippet)
  };

  const handleSaveMovement = async () => {
    if (movForm.valor <= 0) return alert("Digite um valor válido");
    setIsSaving(true);
    try {
      await db.addCashMovement(movForm);
      setMovForm({ tipo: 'Saída', categoria: 'Insumos', descricao: '', valor: 0 });
      await refreshData();
      showToast("Movimentação registrada!");
    } catch (e) {
      showToast("Erro ao salvar movimentação", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMovement = async (id: string) => {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await db.deleteCashMovement(id);
      refreshData();
    } catch (e) {
      alert("Erro ao excluir");
    }
  };

  const generateFinancePDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    // --- CABEÇALHO ---
    if (config?.logoUrl) {
      try {
        // Tenta adicionar a logo (supondo que seja base64 ou URL acessível)
        doc.addImage(config.logoUrl, 'PNG', margin, y, 30, 30);
        y += 35;
      } catch (e) {
        console.error("Erro ao incluir logo no PDF:", e);
      }
    }

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(config?.businessName || 'Relatório Financeiro', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data do Relatório: ${globalDate}`, margin, y);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y + 5);
    y += 20;

    // --- SEÇÃO ANALÍTICA: VENDAS ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DETALHAMENTO DE VENDAS (ENTRADAS)', margin, y);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ID', margin, y);
    doc.text('Cliente', margin + 15, y);
    doc.text('Pagamento', margin + 80, y);
    doc.text('Taxa', margin + 120, y);
    doc.text('Total', margin + 150, y);
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    caixaData.dailyOrders.forEach((o) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.text(o.id.slice(-4), margin, y);
      doc.text(o.customerName.substring(0, 30), margin + 15, y);
      doc.text(o.paymentMethod, margin + 80, y);
      doc.text(`R$ ${o.deliveryFee.toFixed(2)}`, margin + 120, y);
      doc.text(`R$ ${o.total.toFixed(2)}`, margin + 150, y);
      y += 7;
    });

    if (caixaData.dailyOrders.length === 0) {
      doc.text('Nenhuma venda registrada.', margin, y);
      y += 7;
    }
    y += 10;

    // --- SEÇÃO ANALÍTICA: MOVIMENTAÇÕES MANUAIS ---
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. MOVIMENTAÇÕES MANUAIS (LIVRO CAIXA)', margin, y);
    y += 10;

    doc.setFontSize(9);
    doc.text('Tipo', margin, y);
    doc.text('Categoria', margin + 25, y);
    doc.text('Descrição', margin + 60, y);
    doc.text('Valor', margin + 150, y);
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    movements.forEach((m) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setTextColor(m.tipo === 'Entrada' ? '#2e7d32' : '#c62828');
      doc.text(m.tipo, margin, y);
      doc.setTextColor(0);
      doc.text(m.categoria, margin + 25, y);
      doc.text((m.descricao || '-').substring(0, 40), margin + 60, y);
      doc.text(`${m.tipo === 'Entrada' ? '+' : '-'} R$ ${m.valor.toFixed(2)}`, margin + 150, y);
      y += 7;
    });

    if (movements.length === 0) {
      doc.text('Nenhum movimento manual registrado.', margin, y);
      y += 7;
    }
    y += 20;

    // --- SEÇÃO SINTÉTICA: RESUMO FINAL ---
    if (y > 230) { doc.addPage(); y = margin; }
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageWidth - (margin * 2), 55, 'F');

    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO FINANCEIRO CONSOLIDADO', margin + 5, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`(+) Receita Bruta de Vendas:`, margin + 5, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${caixaData.total.toFixed(2)}`, margin + 145, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`    (Produtos: R$ ${caixaData.totalProdutos.toFixed(2)} | Taxas: R$ ${caixaData.totalTaxas.toFixed(2)})`, margin + 5, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`(+) Entradas Manuais Adicionais:`, margin + 5, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${caixaData.entradasManuais.toFixed(2)}`, margin + 145, y);
    y += 6;

    doc.text(`(-) Saídas e Despesas Totais:`, margin + 5, y);
    doc.text(`R$ ${caixaData.saídasManuais.toFixed(2)}`, margin + 145, y);
    y += 8;

    doc.line(margin + 5, y, pageWidth - margin - 5, y);
    y += 8;

    doc.setFontSize(14);
    doc.setTextColor('#1b5e20');
    doc.text(`SALDO REAL EM CAIXA:`, margin + 5, y);
    doc.text(`R$ ${caixaData.saldoReal.toFixed(2)}`, margin + 145, y);

    doc.save(`financeiro_detalhado_${globalDate}.pdf`);
  };

  const handleMarmitaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Arquivo muito grande! Máximo 2MB.");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setMarmitaForm({ ...marmitaForm, imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmLogoUpdate = () => {
    if (tempLogo && config) {
      setConfig({ ...config, logoUrl: tempLogo });
      setShowLogoModal(false);
      setTempLogo(null);
    }
  };

  const handleSaveMarmita = async () => {
    if (!marmitaForm.name || marmitaForm.price <= 0) return alert('Campos inválidos');
    setIsSaving(true);
    try {
      if (editingMarmita) await db.updateMarmita(editingMarmita.id, marmitaForm);
      else await db.saveMarmita(marmitaForm);
      setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '', available: true });
      setEditingMarmita(null);
      await refreshData();
      showToast("Prato salvo com sucesso!");
    } catch (e) { showToast("Erro ao salvar marmita", "error"); }
    finally { setIsSaving(false); }
  };

  const handleSaveBairro = async () => {
    if (!bairroForm.name) return alert('Nome do bairro obrigatório');
    setIsSaving(true);
    try {
      await db.saveBairro(bairroForm);
      setBairroForm({ name: '', deliveryFee: 0 });
      setIsEditingBairro(false);
      await refreshData();
      showToast("Taxa atualizada!");
    } catch (e) { showToast("Erro ao salvar bairro", "error"); }
    finally { setIsSaving(false); }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    try {
      await db.saveCustomer(editingCustomer);
      setEditingCustomer(null);
      await refreshData();
      showToast("Dados do cliente atualizados!");
    } catch (e) { showToast("Erro ao atualizar cliente", "error"); }
    finally { setIsSaving(false); }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await db.saveConfig(config);
      showToast("Configurações salvas!");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) { showToast("Erro ao salvar configurações", "error"); }
    finally { setIsSaving(false); }
  };

  const handleSaveDeliverer = async () => {
    if (!delivererForm.name || !delivererForm.phone) return alert('Nome e telefone são obrigatórios');
    setIsSaving(true);
    try {
      if (editingDeliverer) {
        await db.updateDeliverer(editingDeliverer.id, delivererForm);
        showToast("Entregador atualizado!");
      } else {
        await db.saveDeliverer(delivererForm);
        showToast("Entregador cadastrado!");
      }
      setDelivererForm({
        name: '', phone: '', cpf: '', vehicleType: 'Moto', vehicleModel: '',
        vehiclePlate: '', vehicleColor: '', status: 'Disponível', maxOrders: 3, photoUrl: '', isActive: true, password: ''
      });
      setEditingDeliverer(null);
      await refreshData();
    } catch (e) { showToast("Erro ao salvar entregador", "error"); }
    finally { setIsSaving(false); }
  };

  const handleSaveGrupo = async () => {
    if (!grupoForm.nome) return alert('Nome do grupo é obrigatório');
    setIsSaving(true);
    try {
      if (editingGrupo) {
        await db.updateGrupoOpcional(editingGrupo.id, grupoForm);
      } else {
        await db.saveGrupoOpcional(grupoForm);
      }
      setGrupoForm({ nome: '', minSelecao: 0, maxSelecao: 1 });
      setEditingGrupo(null);
      await refreshData();
      showToast("Grupo salvo com sucesso!");
    } catch (e: any) { showToast("Erro ao salvar grupo: " + (e.message || "Erro desconhecido"), "error"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteGrupo = async (id: string) => {
    if (!confirm("Deseja excluir este grupo e todos os seus opcionais?")) return;
    try {
      await db.deleteGrupoOpcional(id);
      refreshData();
    } catch (e: any) { alert("Erro ao excluir grupo: " + (e.message || "Erro desconhecido")); }
  };

  const handleSaveOpcional = async (grupoId: string) => {
    if (!opcionalForm.nome) return alert('Nome do opcional é obrigatório');
    setIsSaving(true);
    try {
      if (editingOpcional) {
        await db.updateOpcional(editingOpcional.id, opcionalForm);
      } else {
        await db.saveOpcional(grupoId, opcionalForm);
      }
      setOpcionalForm({ nome: '', precoAdicional: 0, disponivel: true, imageUrl: '', gerenciarEstoque: false, estoqueAtual: 0 });
      setIsAddingOpcional(false);
      setEditingOpcional(null);
      await refreshData();
      showToast("Opcional salvo!");
    } catch (e: any) { showToast("Erro ao salvar opcional: " + (e.message || "Erro desconhecido"), "error"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteOpcional = async (id: string) => {
    if (!confirm("Excluir opcional?")) return;
    try {
      await db.deleteOpcional(id);
      await refreshData(); // Garantir que o refresh terminou
    } catch (e: any) { alert("Erro ao excluir opcional: " + (e.message || "Erro desconhecido")); }
  };

  const handleToggleOpcionalDisponibilidade = async (opcional: Opcional) => {
    try {
      await db.updateOpcional(opcional.id, {
        ...opcional,
        disponivel: !opcional.disponivel
      });
      await refreshData();
    } catch (e: any) { alert("Erro ao atualizar disponibilidade: " + (e.message || "Erro desconhecido")); }
  };

  const handleToggleVinculo = async (marmitaId: string, grupoId: string, currentlyVinculado: boolean) => {
    try {
      if (currentlyVinculado) {
        await db.desvincularGrupoMarmita(marmitaId, grupoId);
      } else {
        await db.vincularGrupoMarmita(marmitaId, grupoId);
      }
      await refreshData();
    } catch (e: any) {
      alert("Erro ao atualizar vínculo: " + (e.message || "Erro desconhecido"));
    }
  };

  const handleDeleteDeliverer = async (id: string) => {
    if (!confirm("Desativar este entregador?")) return;
    try {
      await db.deleteDeliverer(id);
      refreshData();
    } catch (e) { alert("Erro ao desativar"); }
  };

  const handleAssignDeliverer = async (delivererId: string, delivererName: string) => {
    if (!orderToAssign) return;
    try {
      await db.assignDeliverer(orderToAssign.id, delivererId, delivererName);
      // Se o pedido estiver em preparo, movemos automaticamente para entrega ao atribuir
      if (orderToAssign.status === 'Preparo' || orderToAssign.status === 'Impresso') {
        await db.updateOrderStatus(orderToAssign.id, 'Entrega');
      }
      setShowAssignModal(false);
      setOrderToAssign(null);
      refreshData();
      alert(`Pedido atribuído a ${delivererName}`);
    } catch (e) { alert("Erro ao atribuir entregador"); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorized = await db.verifyAdminPassword(passwordInput);
    if (authorized) setIsAuthorized(true);
    else alert('Senha Administrativa Inválida');
  };

  const getOrderHtml = (order: Order) => {
    const itemsHtml = Array.isArray(order.items)
      ? order.items.map(i => {
        const optionalsPrice = (i.selectedOptionals || []).reduce((sum, opt) => sum + (opt.precoAdicional || 0), 0);
        const basePrice = i.marmita?.price || 0;
        const itemTotal = (i.quantity || 1) * (basePrice + optionalsPrice);

        const optionalsList = i.selectedOptionals && i.selectedOptionals.length > 0
          ? i.selectedOptionals.map(o => `
            <div style="font-size: 11px; margin-left: 15px; color: #333; display: flex; justify-content: space-between;">
              <span>+ ${o.nome}</span>
              <span>${o.precoAdicional > 0 ? `+ R$ ${o.precoAdicional.toFixed(2)}` : ''}</span>
            </div>
          `).join('')
          : '';

        return `
          <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dotted #ccc;">
            <div class="item-row" style="font-size: 14px;">
              <span>${i.quantity}x ${i.marmita?.name || 'Item'} (${i.marmita?.category || ''})</span>
              <span>R$ ${(i.quantity * basePrice).toFixed(2)}</span>
            </div>
            ${optionalsList}
            <div style="text-align: right; font-size: 12px; margin-top: 5px; font-weight: 900;">
               Total do Item: R$ ${itemTotal.toFixed(2)}
            </div>
          </div>
        `;
      }).join('')
      : '<div>Nenhum item detalhado</div>';

    // Formata a data de forma robusta, garantindo que o fuso horário local seja respeitado
    const orderDate = new Date(order.createdAt);
    const dateStr = orderDate.toLocaleDateString('pt-BR') + ' ' + orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `
      <html>
      <head>
        <title>Pedido #${order.id.slice(-4)}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 10px; font-size: 14px; color: #000; font-weight: bold; background: #fff; line-height: 1.2; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
          .header h3 { margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; }
          .header p { margin: 3px 0; font-size: 14px; }
          .divider { border-top: 1px solid #000; margin: 10px 0; }
          .label { font-weight: 900; font-size: 13px; text-decoration: underline; margin-bottom: 3px; }
          .total-row { font-size: 18px; font-weight: 900; margin-top: 10px; display: flex; justify-content: space-between; border-top: 3px double #000; padding: 10px 0; }
          .item-list { margin: 15px 0; }
          .info-block { margin-bottom: 12px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 13px; }
          .item-row { display: flex; justify-content: space-between; font-weight: 900; }
          .obs-box { border: 1.5px solid #000; padding: 8px; margin-top: 12px; font-size: 13px; background-color: #f9f9f9; }
          .footer { text-align: center; font-size: 11px; margin-top: 20px; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>${config?.businessName || 'Delivery'}</h3>
          <p>Pedido #${order.id.slice(-4)}</p>
          <p>${dateStr}</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="info-block">
          <div class="label">CLIENTE</div>
          <div>${order.customerName}</div>
          <div>${order.customerPhone}</div>
        </div>

        <div class="info-block">
          <div class="label">ENTREGA (${order.deliveryMethod.toUpperCase()})</div>
          ${order.deliveryMethod === 'Retirada'
        ? '<div>Retirada no Balcão</div>'
        : `
              <div>${order.customerAddress}</div>
              <div class="label" style="margin-top:2px">BAIRRO:</div>
              <div>${order.neighborhood}</div>
            `}
        </div>

        <div class="divider"></div>
        
        <div class="label">ITENS DO PEDIDO</div>
        <div class="item-list">
          ${itemsHtml}
        </div>

        ${order.observations ? `
          <div class="obs-box">
            <strong>OBSERVAÇÕES:</strong><br>
            ${order.observations}
          </div>
        ` : ''}

        <div class="divider"></div>

        <div class="info-row">
            <span>Forma Pagto:</span>
            <span>${order.paymentMethod}</span>
        </div>
        <div class="info-row">
            <span>Subtotal:</span>
            <span>R$ ${order.subtotal.toFixed(2)}</span>
        </div>
        <div class="info-row">
            <span>Taxa Entrega:</span>
            <span>R$ ${(order.deliveryFee || 0).toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="total-row">
            <span>TOTAL A PAGAR:</span>
            <span style="font-size:16px;">R$ ${(order.total || 0).toFixed(2)}</span>
        </div>
        
        <div class="footer">
           Obrigado pela preferência!<br>
           www.panelasdavanda.com.br
        </div>
      </body>
      </html>
    `;
  };

  const printOrder = (order: Order) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert("⚠️ Bloqueador de Pop-ups detectado! Por favor, permita pop-ups para este site para que a impressão automática funcione.");
      return;
    }

    const content = getOrderHtml(order);
    win.document.write(content);
    win.document.write(`
      <script>
        window.onload = function() {
          window.print();
          setTimeout(window.close, 500);
        };
      </script>
    `);
    win.document.close();
  };

  const generatePDF = async (order: Order) => {
    // Cria um iframe invisível para renderizar o exato HTML da impressão
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '100%';
    iframe.style.bottom = '100%';
    iframe.style.width = '80mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    doc.write(getOrderHtml(order));
    doc.close();

    // Aguarda fontes e imagens carregarem
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const canvas = await html2canvas(doc.body, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: doc.body.scrollWidth,
        height: doc.body.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        unit: 'mm',
        format: [80, canvas.height * 80 / canvas.width]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
      pdf.save(`Pedido_${order.id.slice(-4)}.pdf`);
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const handleManualPrint = async (order: Order) => {
    try {
      // 1. Gera o PDF (Download automático)
      await generatePDF(order);

      // 2. Dispara a Impressão (Abre janela) se configurado
      if (config?.printMode !== 'Apenas PDF') {
        printOrder(order);
      }
    } catch (err) {
      console.error("Erro na impressão manual:", err);
      alert("Houve um problema ao preparar a impressão.");
    }
  };

  const handleSendMarketing = (customer: Customer) => {
    const link = window.location.origin;
    const menuListStr = currentDayMenu
      .map(m => `• *${m.name}* - ${m.description}`)
      .join('\n');

    let finalMessage = marketingMessage
      .replace(/{nome}/g, customer.name)
      .replace(/{link}/g, link)
      .replace(/{cardapio}/g, menuListStr);

    const encodedMessage = encodeURIComponent(finalMessage);
    const phone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');

    setMarketingSentSet(prev => new Set(prev).add(customer.phone));
  };

  const filteredMenuList = useMemo(() => {
    if (menuDayFilter === 'Todos') return menu;
    return menu.filter(m => m.day === menuDayFilter);
  }, [menu, menuDayFilter]);

  if (isLoading) return <div className="p-20 text-center font-black text-stone-300 animate-pulse tracking-[0.5em]">DBA: SINCRONIZANDO COM O SERVIDOR...</div>;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-md text-center border border-stone-200">
          <div className="bg-stone-900 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
            <i className="fas fa-shield-halved text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter text-stone-800">Autenticação Master</h2>
          <input type="password" placeholder="SENHA DO SISTEMA" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full p-6 bg-stone-50 rounded-3xl mb-6 text-center font-black tracking-[0.6em] outline-none border-2 border-stone-100 focus:border-orange-500 transition-all" />
          <button className="w-full bg-stone-900 text-white py-8 rounded-[2rem] font-black uppercase hover:bg-orange-600 transition-all shadow-2xl shadow-stone-300 text-lg tracking-widest hover:scale-[1.02] active:scale-95">Acessar Painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-40">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
        <div className="flex items-center gap-6">
          {config?.logoUrl && <img src={config.logoUrl} className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-lg" alt="Logo" />}
          <div>
            <h1 className="text-3xl font-black text-stone-900 uppercase leading-none tracking-tighter">Gestão Sênior</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              DB Connection: <span className={dbStatus === 'Online' ? 'text-green-500' : 'text-red-500'}>{dbStatus}</span>
              <span className={`w-2 h-2 rounded-full ${dbStatus === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              {isLocalPrinter && (
                <>
                  <span className="mx-2 text-stone-200">|</span>
                  <span className="text-blue-500 flex items-center gap-1">
                    <i className="fas fa-print"></i> TERMINAL ATIVO
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-stone-200 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'pedidos', icon: 'fa-clipboard-list', label: 'Pedidos' },
            { id: 'caixa', icon: 'fa-chart-pie', label: 'Dinheiro' },
            { id: 'menu', icon: 'fa-utensils', label: 'Menu' },
            { id: 'bairros', icon: 'fa-truck-fast', label: 'Taxas' },
            { id: 'entregadores', icon: 'fa-motorcycle', label: 'Entregas' },
            { id: 'marketing', icon: 'fa-bullhorn', label: 'Marketing' },
            { id: 'clientes', icon: 'fa-address-book', label: 'Clientes' },
            { id: 'config', icon: 'fa-sliders', label: 'Config' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.1em] transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] ${activeTab === tab.id ? 'bg-stone-900 text-white shadow-xl scale-105' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-50'}`}
            >
              <i className={`fas ${tab.icon} text-sm`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-sm border border-stone-100 p-10 min-h-[700px] relative">

        {activeTab === 'pedidos' && (
          <>
            {/* FILA DE PRODUÇÃO (ATIVOS) */}
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center border-b border-stone-50 pb-8 gap-4">
                <h3 className="text-2xl font-black uppercase text-stone-800 tracking-tight">Fila de Produção</h3>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow md:flex-grow-0">
                    <i className="fas fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-sm"></i>
                    <input
                      type="text"
                      placeholder="Filtrar Fone..."
                      value={searchOrderPhone}
                      onChange={e => setSearchOrderPhone(e.target.value)}
                      className="pl-10 pr-4 py-4 bg-stone-50 rounded-2xl font-black border-2 border-stone-100 outline-none focus:border-orange-500 shadow-sm w-full md:w-48 text-xs"
                    />
                  </div>
                  <input
                    type="date"
                    value={globalDate}
                    onChange={e => setGlobalDate(e.target.value)}
                    className="p-4 bg-stone-50 rounded-2xl font-black border-2 border-stone-100 outline-none focus:border-orange-500 shadow-sm text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && !['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).length === 0 ? (
                  <div className="col-span-full py-20 text-center text-stone-200 uppercase font-black tracking-[0.5em]">Tudo limpo por aqui!</div>
                ) : orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && !['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).map(order => (
                  <div key={order.id} className={`p-8 rounded-[2.5rem] border-2 transition-all hover:shadow-xl ${order.status === 'Pendente' ? 'bg-orange-50 border-orange-200' : 'bg-white border-stone-100'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-white text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-tighter">#{order.id.slice(-4)}</span>
                        <span className="text-[10px] font-bold text-stone-400"><i className="far fa-clock mr-1"></i>{new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border ${order.status === 'Entrega' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        order.status === 'Impresso' ? 'bg-purple-600 text-white border-purple-400' :
                          order.status === 'Pendente' ? 'bg-orange-600 text-white border-orange-400' :
                            'bg-stone-900 text-white'
                        }`}>{order.status}</span>
                    </div>

                    <h4 className="font-black text-stone-900 text-lg leading-none mb-1">{order.customerName}</h4>
                    <p className="text-[10px] text-stone-400 font-bold mb-4 uppercase tracking-wider">{order.customerAddress}</p>

                    {/* LISTA DE ITENS RÁPIDA */}
                    <div className="bg-white/50 rounded-xl p-3 mb-4 border border-stone-100/50 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-b border-dashed border-stone-200 last:border-0 pb-2 last:pb-0">
                          {item.marmita.imageUrl && <img src={item.marmita.imageUrl} className="w-8 h-8 rounded-lg object-cover" />}
                          <div className="flex-1">
                            <div className="flex justify-between text-[11px] font-bold text-stone-700">
                              <span>{item.quantity}x {item.marmita.name}</span>
                            </div>
                            {item.marmita.prepTime && <p className="text-[9px] text-stone-400 flex items-center gap-1"><i className="fas fa-clock"></i> {item.marmita.prepTime}</p>}
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 mt-1 border-t border-stone-200 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                          <span>Produtos:</span>
                          <span>R$ {order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                          <span>Taxa:</span>
                          <span>R$ {order.deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-stone-100 flex justify-between text-xs font-black text-stone-900">
                          <span>TOTAL:</span>
                          <span>R$ {order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {order.observations && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                        <p className="text-[10px] font-black uppercase text-red-600 mb-1 tracking-widest"><i className="fas fa-comment-dots mr-2"></i>Observações:</p>
                        <p className="text-xs font-bold text-red-900 leading-relaxed">{order.observations}</p>
                      </div>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button onClick={() => handleManualPrint(order)} className="flex-1 bg-white border-2 border-stone-200 py-4 rounded-[1.5rem] text-[10px] font-black uppercase text-stone-900 hover:bg-stone-50 hover:border-stone-900 transition-all shadow-sm flex items-center justify-center gap-2">
                        <i className="fas fa-print text-lg"></i>
                        Imprimir
                      </button>
                      <select
                        value={order.status}
                        onChange={e => {
                          const newStatus = e.target.value as OrderStatus;
                          if (newStatus === 'Entrega' && !order.delivererId) {
                            setOrderToAssign(order);
                            setShowAssignModal(true);
                          } else {
                            db.updateOrderStatus(order.id, newStatus).then(refreshData);
                          }
                        }}
                        className="flex-1 bg-stone-900 text-white py-4 rounded-[1.5rem] text-[10px] font-black uppercase outline-none focus:ring-4 ring-orange-500/20 cursor-pointer shadow-xl hover:bg-black transition-all text-center appearance-none"
                      >
                        {['Pendente', 'Impresso', 'Preparo', 'Entrega', 'Finalizado', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {['Preparo', 'Entrega'].includes(order.status) && (
                      <button
                        onClick={() => { setOrderToAssign(order); setShowAssignModal(true); }}
                        className={`w-full mt-3 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${order.delivererName ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
                      >
                        <i className="fas fa-motorcycle text-lg"></i>
                        {order.delivererName ? `Entregador: ${order.delivererName}` : 'Atribuir Entregador'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* PEDIDOS FINALIZADOS (HISTÓRICO DO DIA) */}
            <div className="space-y-6 pt-12 border-t border-stone-100 animate-fade-in">
              <h3 className="text-xl font-black uppercase text-stone-400 tracking-tight flex items-center gap-3">
                <i className="fas fa-check-double"></i>
                Histórico Finalizado
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-75 hover:opacity-100 transition-opacity">
                {orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && ['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).length === 0 ? (
                  <div className="col-span-full py-10 text-center text-stone-200 uppercase font-black tracking-widest text-xs">Nenhum pedido finalizado hoje</div>
                ) : orders.filter(o => o.createdAt && o.createdAt.startsWith(globalDate) && ['Finalizado', 'Cancelado'].includes(o.status)).filter(o => !searchOrderPhone || o.customerPhone.includes(searchOrderPhone.replace(/\D/g, ''))).map(order => (
                  <div key={order.id} className="p-5 rounded-[2rem] border border-stone-100 bg-stone-50">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-[9px] font-black text-stone-400 mr-2">#{order.id.slice(-4)}</span>
                        <span className="text-[9px] font-bold text-stone-300">{new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${order.status === 'Cancelado' ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>{order.status}</span>
                    </div>
                    <h4 className="font-bold text-stone-700 text-sm truncate">{order.customerName}</h4>
                    <p className="text-[10px] text-stone-400 mb-3 truncate">{order.items.length} itens • R$ {order.total.toFixed(2)}</p>
                    <button onClick={() => handleManualPrint(order)} className="w-full bg-white border border-stone-200 py-3 rounded-xl text-[10px] font-black uppercase text-stone-400 hover:text-stone-900 hover:border-stone-900 transition-all flex items-center justify-center gap-2">
                      <i className="fas fa-print"></i>
                      Reimprimir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'caixa' && (
          <div className="space-y-6 animate-fade-in mb-20">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <i className="fas fa-sack-dollar text-2xl"></i>
                </div>
                <div>
                  <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Fluxo de Caixa</h3>
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">Resumo analítico da operação</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={generateFinancePDF}
                  className="bg-white border-2 border-stone-100 p-4 rounded-2xl text-stone-500 hover:text-orange-600 hover:border-orange-500 transition-all shadow-sm flex items-center gap-3"
                >
                  <i className="fas fa-file-pdf"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">Relatório PDF</span>
                </button>
                <div className="bg-stone-50 p-4 rounded-3xl border border-stone-100 flex items-center gap-4 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest pl-2">Data Base:</span>
                  <input
                    type="date"
                    value={globalDate}
                    onChange={(e) => setGlobalDate(e.target.value)}
                    className="bg-transparent font-black text-stone-700 outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Dash Compacto Refatorado */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100 flex flex-col justify-center shadow-sm">
                <span className="text-[9px] font-black uppercase text-green-600 mb-1 tracking-widest">Saldo Real (Líquido)</span>
                <span className="text-3xl font-black text-green-700">R$ {caixaData.saldoReal.toFixed(2)}</span>
              </div>
              <div className="bg-stone-900 p-6 rounded-[2rem] text-white flex flex-col justify-center shadow-xl">
                <span className="text-[9px] font-black uppercase opacity-60 mb-1 tracking-widest">Vendas (Bruto)</span>
                <span className="text-3xl font-black">R$ {caixaData.total.toFixed(2)}</span>
              </div>
              <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-orange-600 mb-1 tracking-widest block">Vendas Detalhadas</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-orange-800">Produtos: R$ {caixaData.totalProdutos.toFixed(2)}</span>
                  <span className="text-xs font-bold text-orange-400">Entrega: R$ {caixaData.totalTaxas.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex flex-col justify-center shadow-sm">
                <span className="text-[9px] font-black uppercase text-red-600 mb-1 tracking-widest">Saídas (Despesas)</span>
                <span className="text-2xl font-black text-red-700">- R$ {caixaData.saídasManuais.toFixed(2)}</span>
              </div>
              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-blue-600 mb-2 tracking-widest block text-center">Pagamentos</span>
                <div className="flex justify-around gap-2">
                  {Object.entries(caixaData.sintético).map(([method, val]: any) => (
                    <div key={method} className="text-center">
                      <span className="text-[8px] font-black uppercase text-blue-400 block">{method}</span>
                      <span className="text-[11px] font-black text-blue-900">R${val.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Listagem Analítica de Pedidos */}
              <div className="lg:col-span-8 bg-stone-50 rounded-[3rem] border border-stone-100 overflow-hidden shadow-sm">
                <div className="p-6 bg-white border-b border-stone-100 flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">Relatório de Entradas (Vendas)</h4>
                  <span className="text-[10px] font-black text-stone-300 uppercase">Apenas pedidos não cancelados</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-100/50">
                        <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">ID</th>
                        <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">Cliente</th>
                        <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 text-right">Taxa</th>
                        <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {caixaData.dailyOrders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-20 text-center text-stone-300 uppercase font-black tracking-widest text-xs">Sem vendas nesta data</td>
                        </tr>
                      ) : caixaData.dailyOrders.map(o => (
                        <tr key={o.id} className="hover:bg-white transition-colors group">
                          <td className="p-5 text-[10px] font-black text-stone-400">#{o.id.slice(-4)}</td>
                          <td className="p-5">
                            <p className="text-xs font-black text-stone-800 uppercase">{o.customerName}</p>
                            <p className="text-[9px] text-stone-400 font-bold">{o.paymentMethod}</p>
                          </td>
                          <td className="p-5 text-right text-stone-400 text-xs font-bold">R$ {o.deliveryFee.toFixed(2)}</td>
                          <td className="p-5 text-right text-xs font-black text-stone-900">R$ {o.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LIVRO CAIXA (MOVIMENTAÇÕES MANUAIS) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border-2 border-stone-100 shadow-xl">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-900 mb-6 flex items-center gap-2">
                    <i className="fas fa-plus-circle text-orange-500"></i> Lançamento Manual
                  </h4>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMovForm({ ...movForm, tipo: 'Entrada' })}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${movForm.tipo === 'Entrada' ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-stone-50 text-stone-400'}`}
                      >Entrada</button>
                      <button
                        onClick={() => setMovForm({ ...movForm, tipo: 'Saída' })}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${movForm.tipo === 'Saída' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-stone-50 text-stone-400'}`}
                      >Saída</button>
                    </div>
                    <select
                      value={movForm.categoria}
                      onChange={e => setMovForm({ ...movForm, categoria: e.target.value })}
                      className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-xs font-bold shadow-inner"
                    >
                      <option>Insumos</option>
                      <option>Material Prima</option>
                      <option>Embalagens</option>
                      <option>Estorno</option>
                      <option>Outros</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Descrição (ex: Bife do Dia)"
                      value={movForm.descricao}
                      onChange={e => setMovForm({ ...movForm, descricao: e.target.value })}
                      className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-xs font-bold shadow-inner"
                    />
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-stone-400 text-xs">R$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={movForm.valor || ''}
                        onChange={e => setMovForm({ ...movForm, valor: parseFloat(e.target.value) || 0 })}
                        className="w-full p-4 pl-10 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-xs font-black shadow-inner"
                      />
                    </div>
                    <button
                      onClick={handleSaveMovement}
                      disabled={isSaving}
                      className={`w-full ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-orange-600'} text-white py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl ${!isSaving && 'active:scale-95'} flex items-center justify-center gap-3`}
                    >
                      {isSaving ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-check-circle"></i>}
                      {isSaving ? 'PROCESSANDO...' : 'Efetivar Lançamento'}
                    </button>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-[2.5rem] border border-stone-100 p-6 max-h-[400px] overflow-y-auto shadow-inner">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">Movimentos Manuais</h4>
                  <div className="space-y-3">
                    {movements.length === 0 ? (
                      <p className="text-[10px] text-center py-10 text-stone-300 font-bold uppercase">Nenhum movimento manual</p>
                    ) : movements.map(m => (
                      <div key={m.id} className="bg-white p-4 rounded-2xl border border-stone-100 flex justify-between items-center group shadow-sm transition-all hover:shadow-md">
                        <div>
                          <p className="text-[10px] font-black uppercase text-stone-800">{m.categoria}</p>
                          <p className="text-[9px] text-stone-400 font-medium">{m.descricao || 'Sem descrição'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black ${m.tipo === 'Entrada' ? 'text-green-500' : 'text-red-500'}`}>
                            {m.tipo === 'Entrada' ? '+' : '-'} R$ {m.valor.toFixed(2)}
                          </span>
                          <button onClick={() => handleDeleteMovement(m.id)} className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all text-xs">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 animate-fade-in">
            <div className="space-y-8">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">{editingMarmita ? 'Editar Prato' : 'Novo Cardápio'}</h3>
              <div className="space-y-5 bg-stone-50 p-10 rounded-[4rem] border border-stone-100 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Prato</label>
                  <input type="text" placeholder="Ex: Bife com Fritas" value={marmitaForm.name} onChange={e => setMarmitaForm({ ...marmitaForm, name: e.target.value })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-sm transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Descrição / Ingredientes</label>
                  <textarea
                    placeholder="Descreva os ingredientes..."
                    rows={3}
                    value={marmitaForm.description}
                    onChange={e => setMarmitaForm({ ...marmitaForm, description: e.target.value })}
                    className="w-full p-6 rounded-3xl border-2 border-white outline-none font-medium focus:border-orange-500 shadow-sm transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4 flex items-center gap-2">
                    <i className="fas fa-image text-orange-500"></i> URL ou Upload da Imagem
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={marmitaForm.imageUrl || ''}
                      onChange={e => setMarmitaForm({ ...marmitaForm, imageUrl: e.target.value })}
                      className="w-full pl-6 pr-16 py-6 rounded-3xl border-2 border-white outline-none font-medium focus:border-orange-500 shadow-sm transition-all text-xs"
                    />
                    <label className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-all shadow-lg active:scale-90">
                      <i className="fas fa-camera"></i>
                      <input type="file" className="hidden" accept="image/*" onChange={handleMarmitaImageUpload} />
                    </label>
                  </div>

                  {marmitaForm.imageUrl && (
                    <div className="relative mt-2 w-full h-32 rounded-3xl overflow-hidden border-2 border-white shadow-inner bg-stone-100 group">
                      <img src={marmitaForm.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                      <button
                        onClick={() => setMarmitaForm({ ...marmitaForm, imageUrl: '' })}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4 flex items-center gap-2">
                    <i className="fas fa-clock text-orange-500"></i> Tempo de Preparo
                  </label>
                  <div className="relative">
                    <i className="far fa-hourglass-half absolute left-6 top-1/2 -translate-y-1/2 text-stone-300"></i>
                    <input
                      type="text"
                      placeholder="Ex: 20-30 min"
                      value={marmitaForm.prepTime || ''}
                      onChange={e => setMarmitaForm({ ...marmitaForm, prepTime: e.target.value })}
                      className="w-full pl-14 pr-6 py-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-stone-300 text-xs">R$</span>
                      <input type="number" step="0.01" placeholder="0.00" value={marmitaForm.price} onChange={e => setMarmitaForm({ ...marmitaForm, price: parseFloat(e.target.value) })} className="w-full pl-12 pr-6 py-6 rounded-3xl border-2 border-white outline-none font-black focus:border-orange-500 shadow-sm transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Categoria</label>
                    <select value={marmitaForm.category} onChange={e => setMarmitaForm({ ...marmitaForm, category: e.target.value as any })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold shadow-sm cursor-pointer focus:border-orange-500 appearance-none bg-white">
                      {['Pequena', 'Média', 'Grande', 'Executiva'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Dia da Semana</label>
                  <select value={marmitaForm.day} onChange={e => setMarmitaForm({ ...marmitaForm, day: e.target.value as DayOfWeek })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold shadow-sm cursor-pointer focus:border-orange-500 appearance-none bg-white">
                    {DAYS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="bg-white p-6 rounded-3xl border-2 border-white shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={marmitaForm.available}
                      onChange={e => setMarmitaForm({ ...marmitaForm, available: e.target.checked })}
                      className="w-5 h-5 accent-orange-500 rounded-lg"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-stone-400 leading-none mb-1">Status de Disponibilidade</span>
                      <span className={`text-xs font-black uppercase tracking-tight ${marmitaForm.available ? 'text-green-600' : 'text-stone-400'}`}>
                        {marmitaForm.available ? 'Disponível no Cardápio' : 'Indisponível (Ocultar)'}
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleSaveMarmita}
                  disabled={isSaving}
                  className={`w-full ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-orange-600'} text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all transform ${!isSaving && 'hover:scale-[1.02] active:scale-95'} mt-4 flex items-center justify-center gap-4 text-xs`}
                >
                  {isSaving ? (
                    <><i className="fas fa-spinner animate-spin"></i> SALVANDO...</>
                  ) : (
                    <><i className="fas fa-cookie-bite text-xl"></i> {editingMarmita ? 'Atualizar Prato' : 'Confirmar e Publicar'}</>
                  )}
                </button>

                <div className="pt-6 border-t-2 border-white">
                  <div className="flex justify-between items-center mb-4 px-4">
                    <label className="text-[10px] font-black uppercase text-stone-400">Grupos de Opcionais</label>
                    <button
                      onClick={() => setShowOpcionalModal(true)}
                      className="text-[10px] font-black uppercase text-orange-600 hover:text-orange-700 underline"
                    >
                      Gerenciar Grupos
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto px-2">
                    {gruposOpcionais.length === 0 ? (
                      <p className="text-[9px] text-stone-300 uppercase font-black text-center py-4">Nenhum grupo cadastrado</p>
                    ) : (
                      gruposOpcionais.map(g => {
                        const currentMarmitaInMenu = menu.find(m => String(m.id) === String(editingMarmita?.id));
                        const isVinculado = currentMarmitaInMenu?.gruposOpcionais?.some(v => String(v.id) === String(g.id));
                        return (
                          <div key={g.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-stone-100 shadow-sm">
                            <span className="text-[10px] font-bold text-stone-600 uppercase">{g.nome}</span>
                            <button
                              onClick={() => editingMarmita && handleToggleVinculo(editingMarmita.id, g.id, !!isVinculado)}
                              disabled={!editingMarmita}
                              className={`text-[9px] font-black uppercase px-4 py-2 rounded-full transition-all group/btn ${!editingMarmita ? 'opacity-20 bg-stone-100 cursor-not-allowed' :
                                isVinculado
                                  ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                  : 'bg-stone-100 text-stone-400 hover:bg-stone-900 hover:text-white'
                                }`}
                            >
                              {isVinculado ? (
                                <span className="flex items-center gap-2">
                                  <span className="group-hover/btn:hidden">Vínculado</span>
                                  <span className="hidden group-hover/btn:inline flex items-center gap-1">
                                    <i className="fas fa-times text-[7px]"></i> Desvincular
                                  </span>
                                </span>
                              ) : (
                                'Vincular'
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {!editingMarmita && (
                    <p className="text-[8px] text-stone-400 font-bold uppercase mt-2 px-4 italic">
                      * Salve o prato antes de vincular grupos
                    </p>
                  )}
                </div>
                {editingMarmita && (
                  <button onClick={() => {
                    setEditingMarmita(null);
                    setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '', available: true });
                  }} className="w-full text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                    Cancelar Edição
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Produtos Cadastrados</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-stone-400">Filtrar Dia:</span>
                  <select
                    value={menuDayFilter}
                    onChange={(e) => setMenuDayFilter(e.target.value as any)}
                    className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none focus:border-orange-500"
                  >
                    <option value="Todos">Todos</option>
                    {DAYS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[700px] overflow-y-auto pr-4 no-scrollbar">
                {filteredMenuList.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-stone-200 uppercase font-black tracking-[0.2em]">Nenhum prato encontrado</div>
                ) : filteredMenuList.map(m => (
                  <div key={m.id} className="flex flex-col p-8 bg-stone-50 rounded-[3rem] border border-stone-100 hover:border-orange-200 hover:bg-white transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase text-white ${m.available ? 'bg-green-500' : 'bg-red-500'}`}>
                            {m.available ? 'Online' : 'Offline'}
                          </span>
                          <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">
                            {m.category}
                          </span>
                          {m.prepTime && (
                            <span className="text-[9px] font-black uppercase text-stone-500 bg-stone-200 px-3 py-1.5 rounded-full flex items-center gap-1">
                              <i className="fas fa-clock"></i> {m.prepTime}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">{m.day}</p>
                        {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-32 object-cover rounded-2xl mb-3 shadow-sm" />}
                        <h5 className="font-bold text-stone-800 text-base leading-tight">{m.name}</h5>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingMarmita(m); setMarmitaForm(m); }} className="w-10 h-10 bg-white text-blue-500 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"><i className="fas fa-edit"></i></button>
                        <button onClick={() => { if (confirm("Excluir item?")) db.deleteMarmita(m.id).then(refreshData); }} className="w-10 h-10 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"><i className="fas fa-trash"></i></button>
                      </div>
                    </div>

                    <p className="text-stone-500 text-xs mb-4 line-clamp-2 min-h-[2rem]">{m.description || 'Sem descrição informada.'}</p>

                    <div className="mt-auto pt-4 border-t border-stone-100 flex justify-between items-center">
                      <span className="font-black text-stone-900 text-lg">R$ {m.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bairros' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-fade-in">
            <div className="space-y-8">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Zonas de Entrega</h3>
              <div className="space-y-6 p-12 bg-stone-50 rounded-[4rem] border border-stone-100 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Bairro</label>
                  <input type="text" placeholder="Ex: Centro" value={bairroForm.name} onChange={e => setBairroForm({ ...bairroForm, name: e.target.value })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-bold focus:border-orange-500 shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Taxa de Entrega (R$)</label>
                  <input type="number" placeholder="0.00" value={bairroForm.deliveryFee} onChange={e => setBairroForm({ ...bairroForm, deliveryFee: parseFloat(e.target.value) })} className="w-full p-6 rounded-3xl border-2 border-white outline-none font-black focus:border-orange-500 shadow-inner" />
                </div>
                <button
                  onClick={handleSaveBairro}
                  disabled={isSaving}
                  className={`w-full ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-orange-600'} text-white py-8 rounded-[2.5rem] font-black uppercase shadow-2xl transition-all text-xs tracking-[0.2em] flex items-center justify-center gap-4 ${!isSaving && 'hover:scale-[1.02] active:scale-95'}`}
                >
                  {isSaving ? (
                    <><i className="fas fa-spinner animate-spin"></i> PROCESSANDO...</>
                  ) : (
                    <><i className="fas fa-truck-ramp-box text-xl"></i> {isEditingBairro ? 'Atualizar Taxa' : 'Registrar Bairro'}</>
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="font-black uppercase text-2xl text-stone-900 tracking-tighter">Malha Ativa</h3>
              <div className="grid gap-4">
                {(bairros || []).map(b => (
                  <div key={b.name} className="flex justify-between items-center p-8 bg-stone-50 rounded-[2.5rem] border border-stone-100 group transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1">
                    <span className="font-black text-stone-800 text-lg uppercase tracking-tighter">{b.name}</span>
                    <div className="flex items-center gap-8">
                      <span className="font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl text-base shadow-sm">R$ {b.deliveryFee.toFixed(2)}</span>
                      <div className="flex gap-4">
                        <button onClick={() => { setBairroForm(b); setIsEditingBairro(true); }} className="text-blue-500 hover:scale-150 transition-transform"><i className="fas fa-edit text-xl"></i></button>
                        <button onClick={() => { if (confirm("Excluir bairro?")) db.deleteBairro(b.name).then(refreshData); }} className="text-red-400 hover:scale-150 transition-transform"><i className="fas fa-circle-xmark text-xl"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clientes' && (
          <div className="space-y-12 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-stone-50 pb-12">
              <h3 className="text-3xl font-black uppercase text-stone-900 tracking-tighter">Base de Clientes (CRM)</h3>
              <div className="relative w-full max-w-xl">
                <i className="fas fa-search absolute left-8 top-1/2 -translate-y-1/2 text-stone-300 text-xl"></i>
                <input type="text" placeholder="Filtrar por Nome ou WhatsApp..." value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="w-full pl-20 pr-8 py-7 bg-stone-50 rounded-[2.5rem] border-2 border-stone-100 outline-none font-bold focus:border-orange-500 shadow-inner text-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {(customers || []).filter(c => (c.name || '').toLowerCase().includes(searchCustomer.toLowerCase()) || (c.phone || '').includes(searchCustomer)).map(c => (
                <div key={c.phone} className="p-12 bg-stone-50 rounded-[4rem] border border-stone-100 relative group hover:shadow-2xl transition-all hover:-translate-y-2 bg-gradient-to-br from-stone-50 to-white">
                  <div className="flex justify-between items-start mb-8">
                    <div className="bg-stone-900 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl">
                      <i className="fas fa-user-circle text-2xl"></i>
                    </div>
                    <button onClick={() => setEditingCustomer(c)} className="text-stone-300 hover:text-blue-600 transition-all transform hover:scale-125"><i className="fas fa-user-pen text-xl"></i></button>
                  </div>

                  <h5 className="font-black text-stone-900 text-2xl leading-none mb-3 uppercase tracking-tighter truncate">{c.name}</h5>
                  <p className="text-orange-600 font-black text-sm mb-8 flex items-center gap-3 tracking-widest"><i className="fab fa-whatsapp text-lg"></i> {c.phone}</p>

                  <button onClick={() => setViewingCustomerOrders(c)} className="w-full bg-white border-2 border-stone-100 text-stone-400 font-black uppercase py-4 rounded-2xl hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all text-xs tracking-widest shadow-sm">
                    <i className="fas fa-history mr-2"></i> Ver Histórico
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}



        {activeTab === 'config' && config && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            <div className="space-y-10">
              {/* SESSÃO DE LOGO */}
              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter">
                <div className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-xl shadow-blue-100"><i className="fas fa-image"></i></div>
                Identidade Visual
              </h3>
              <div className="bg-stone-50 p-12 rounded-[4rem] border border-stone-100 flex flex-col md:flex-row items-center gap-12">
                <div className="w-40 h-40 bg-white rounded-[3rem] shadow-2xl border-4 border-white overflow-hidden flex items-center justify-center relative group">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  ) : (
                    <i className="fas fa-store text-5xl text-stone-200"></i>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-xl font-black text-stone-900 uppercase mb-4">Logo do Negócio</h4>
                  <p className="text-stone-400 text-sm font-medium mb-8">Esta imagem aparece no topo do site e nas comandas de impressão.</p>
                  <button
                    onClick={() => setShowLogoModal(true)}
                    className="bg-stone-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-600 transition-all shadow-xl"
                  >
                    Alterar Logomarca
                  </button>
                </div>
              </div>


              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-16">
                <div className="bg-orange-600 text-white p-5 rounded-[2rem] shadow-xl shadow-orange-100"><i className="fas fa-clock"></i></div>
                Horário de Atendimento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-stone-50 p-12 rounded-[4rem] border border-stone-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Abertura dos Pedidos</label>
                  <input type="time" value={config.openingTime} onChange={e => setConfig({ ...config, openingTime: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Fechamento dos Pedidos</label>
                  <input type="time" value={config.closingTime} onChange={e => setConfig({ ...config, closingTime: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <p className="md:col-span-2 text-[10px] text-stone-400 font-bold uppercase text-center">Clientes fora deste horário verão um modal informativo e não poderão fechar pedidos.</p>
              </div>

              <h3 className="text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-16">
                <div className="bg-stone-900 text-white p-5 rounded-[2rem] shadow-xl"><i className="fas fa-fingerprint"></i></div>
                Informações de Contato
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-stone-50 p-12 rounded-[4rem] border border-stone-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Nome do Negócio</label>
                  <input type="text" value={config.businessName} onChange={e => setConfig({ ...config, businessName: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">WhatsApp para Pedidos</label>
                  <input type="text" value={config.businessWhatsApp} onChange={e => setConfig({ ...config, businessWhatsApp: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Instagram (URL)</label>
                  <input type="text" placeholder="https://instagram.com/sua-loja" value={config.instagramUrl || ''} onChange={e => setConfig({ ...config, instagramUrl: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Facebook (URL)</label>
                  <input type="text" placeholder="https://facebook.com/sua-loja" value={config.facebookUrl || ''} onChange={e => setConfig({ ...config, facebookUrl: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm" />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Senha do Administrador</label>
                  <input type="password" value={config.adminPassword || ''} onChange={e => setConfig({ ...config, adminPassword: e.target.value })} className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 tracking-[1em] shadow-sm" />
                </div>

                <h3 className="md:col-span-2 text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-8">
                  <div className="bg-green-600 text-white p-5 rounded-[2rem] shadow-xl shadow-green-100"><i className="fas fa-print"></i></div>
                  Configurações de Impressão
                </h3>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Impressão Automática</label>
                  <select
                    value={config.autoPrint ? 'Sim' : 'Não'}
                    onChange={e => setConfig({ ...config, autoPrint: e.target.value === 'Sim' })}
                    className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm"
                  >
                    <option value="Não">Não (Manual)</option>
                    <option value="Sim">Sim (Automática)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Nome da Impressora (Referencial)</label>
                  <input
                    type="text"
                    placeholder="Ex: Impressora Térmica"
                    value={config.printerName || ''}
                    onChange={e => setConfig({ ...config, printerName: e.target.value })}
                    className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Modo de Operação</label>
                  <select
                    value={config.printMode || 'PDF + Impressão'}
                    onChange={e => setConfig({ ...config, printMode: e.target.value as any })}
                    className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm"
                  >
                    <option value="PDF + Impressão">PDF + Abrir Janela de Impressão</option>
                    <option value="Apenas PDF">Apenas Download (Para Bridge/Sumatra)</option>
                  </select>
                </div>

                <div className="md:col-span-2 mt-8 p-8 bg-white border-2 border-dashed border-stone-200 rounded-[3rem] flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isLocalPrinter ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400'}`}>
                    <i className={`fas ${isLocalPrinter ? 'fa-print' : 'fa-print-slash'} text-2xl`}></i>
                  </div>
                  <h4 className="text-lg font-black text-stone-900 uppercase tracking-tighter mb-2">Terminal de Impressão Local</h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase mb-6 max-w-sm">
                    Ative esta opção apenas no computador da cozinha. Quando ativa, este computador abrirá o PDF de novos pedidos automaticamente.
                  </p>
                  <button
                    onClick={() => toggleLocalPrinter(!isLocalPrinter)}
                    className={`px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl ${isLocalPrinter ? 'bg-green-600 text-white shadow-green-100' : 'bg-stone-900 text-white shadow-stone-200'}`}
                  >
                    {isLocalPrinter ? 'Desativar neste Dispositivo' : 'Ativar neste Dispositivo'}
                  </button>
                </div>

                <h3 className="md:col-span-2 text-3xl font-black uppercase text-stone-900 flex items-center gap-6 tracking-tighter mt-8">
                  <div className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-xl shadow-blue-100"><i className="fab fa-cc-visa"></i></div>
                  Integração Mercado Pago
                </h3>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Pagamento Online</label>
                  <select
                    value={config.mercadoPagoEnabled ? 'Ativado' : 'Desativado'}
                    onChange={e => setConfig({ ...config, mercadoPagoEnabled: e.target.value === 'Ativado' })}
                    className={`w-full p-6 rounded-3xl font-black outline-none border-2 transition-all shadow-sm ${config.mercadoPagoEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-transparent text-stone-400'}`}
                  >
                    <option value="Desativado">🔴 Desativado (Pagamentos Manuais)</option>
                    <option value="Ativado">🟢 Ativado (Cartão e Pix Online)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 ml-5 tracking-[0.2em]">Public Key (Sandbox ou Produção)</label>
                  <input
                    type="text"
                    placeholder="APP_USR-..."
                    value={config.mercadoPagoPublicKey || ''}
                    onChange={e => setConfig({ ...config, mercadoPagoPublicKey: e.target.value })}
                    className="w-full p-6 bg-white rounded-3xl font-black text-stone-800 outline-none border-2 border-transparent focus:border-orange-500 shadow-sm transition-all"
                  />
                  <p className="text-[9px] text-stone-400 font-bold px-4">Esta chave é segura para o frontend. O Access Token deve ser configurado apenas no backend (Supabase).</p>
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className={`md:col-span-2 w-full ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-orange-600'} text-white py-8 rounded-[2.5rem] font-black uppercase shadow-2xl transition-all mt-8 text-xl tracking-[0.2em] flex items-center justify-center gap-6 group ${!isSaving && 'hover:scale-[1.01] active:scale-95'}`}
              >
                {isSaving ? (
                  <><i className="fas fa-spinner animate-spin text-3xl"></i> SALVANDO...</>
                ) : (
                  <><i className="fas fa-save text-3xl group-hover:scale-110 transition-transform"></i> Efetivar Configurações</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ABA DE ENTREGADORES */}
        {activeTab === 'entregadores' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-stone-100 pb-8 gap-4">
              <h3 className="text-2xl font-black uppercase text-stone-800 tracking-tight flex items-center gap-3">
                <i className="fas fa-motorcycle text-orange-500"></i>
                Gestão de Entregadores
              </h3>
              <div className="bg-stone-900 text-white px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                {deliverers.filter(d => d.isActive).length} Ativos
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* FORMULÁRIO DE CADASTRO */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-stone-50 p-8 rounded-[2.5rem] border border-stone-100 sticky top-8">
                  <h4 className="text-lg font-black uppercase text-stone-900 mb-6 flex items-center gap-2">
                    {editingDeliverer ? <i className="fas fa-edit text-blue-500"></i> : <i className="fas fa-plus-circle text-green-500"></i>}
                    {editingDeliverer ? 'Editar Entregador' : 'Novo Entregador'}
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Nome Completo</label>
                      <input
                        type="text"
                        value={delivererForm.name}
                        onChange={e => setDelivererForm({ ...delivererForm, name: e.target.value })}
                        className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                        placeholder="Ex: João da Silva"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={delivererForm.phone}
                        onChange={e => setDelivererForm({ ...delivererForm, phone: e.target.value })}
                        className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                        placeholder="(XX) XXXXX-XXXX"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">CPF</label>
                      <input
                        type="text"
                        value={delivererForm.cpf}
                        onChange={e => setDelivererForm({ ...delivererForm, cpf: e.target.value })}
                        className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Senha de Acesso</label>
                      <input
                        type="text"
                        value={delivererForm.password || ''}
                        onChange={e => setDelivererForm({ ...delivererForm, password: e.target.value })}
                        className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                        placeholder="Defina uma senha"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Veículo</label>
                        <select
                          value={delivererForm.vehicleType}
                          onChange={e => setDelivererForm({ ...delivererForm, vehicleType: e.target.value as VehicleType })}
                          className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm appearance-none"
                        >
                          <option value="Moto">Moto</option>
                          <option value="Carro">Carro</option>
                          <option value="Bicicleta">Bike</option>
                          <option value="A pé">A pé</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Placa</label>
                        <input
                          type="text"
                          value={delivererForm.vehiclePlate}
                          onChange={e => setDelivererForm({ ...delivererForm, vehiclePlate: e.target.value })}
                          className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                          placeholder="ABC-1234"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Modelo</label>
                        <input
                          type="text"
                          value={delivererForm.vehicleModel}
                          onChange={e => setDelivererForm({ ...delivererForm, vehicleModel: e.target.value })}
                          className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                          placeholder="Ex: Honda CG"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Cor</label>
                        <input
                          type="text"
                          value={delivererForm.vehicleColor}
                          onChange={e => setDelivererForm({ ...delivererForm, vehicleColor: e.target.value })}
                          className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm"
                          placeholder="Ex: Vermelha"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-400 ml-4 mb-1 block">Status Inicial</label>
                      <select
                        value={delivererForm.status}
                        onChange={e => setDelivererForm({ ...delivererForm, status: e.target.value as DelivererStatus })}
                        className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold focus:border-orange-500 transition-all shadow-sm appearance-none"
                      >
                        <option value="Disponível">Disponível</option>
                        <option value="Indisponível">Indisponível</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={handleSaveDeliverer}
                        disabled={isSaving}
                        className={`flex-1 ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-green-600'} text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg ${!isSaving && 'hover:scale-[1.02] active:scale-95'}`}
                      >
                        {isSaving ? <i className="fas fa-spinner animate-spin"></i> : (editingDeliverer ? 'Atualizar' : 'Cadastrar')}
                      </button>
                      {editingDeliverer && (
                        <button
                          onClick={() => {
                            setEditingDeliverer(null);
                            setDelivererForm({
                              name: '', phone: '', cpf: '', vehicleType: 'Moto', vehicleModel: '',
                              vehiclePlate: '', vehicleColor: '', status: 'Disponível', maxOrders: 3, photoUrl: '', isActive: true
                            });
                          }}
                          className="px-4 bg-stone-200 text-stone-500 rounded-2xl hover:bg-red-100 hover:text-red-500 transition-all"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* LISTA DE ENTREGADORES */}
              <div className="lg:col-span-2 space-y-4">
                {deliverers.filter(d => d.isActive).length === 0 ? (
                  <div className="text-center py-20 bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200">
                    <i className="fas fa-motorcycle text-4xl text-stone-200 mb-4"></i>
                    <p className="text-stone-300 font-black uppercase tracking-widest">Nenhum entregador cadastrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deliverers.filter(d => d.isActive).map(deliverer => (
                      <div key={deliverer.id} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-stone-100 to-transparent rounded-bl-[4rem] -mr-4 -mt-4 transition-all group-hover:scale-150 group-hover:from-orange-50`}></div>

                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${deliverer.vehicleType === 'Moto' ? 'bg-blue-50 text-blue-500' :
                                deliverer.vehicleType === 'Carro' ? 'bg-purple-50 text-purple-500' :
                                  deliverer.vehicleType === 'Bicicleta' ? 'bg-green-50 text-green-500' :
                                    'bg-orange-50 text-orange-500'
                                }`}>
                                <i className={`fas ${deliverer.vehicleType === 'Moto' ? 'fa-motorcycle' :
                                  deliverer.vehicleType === 'Carro' ? 'fa-car' :
                                    deliverer.vehicleType === 'Bicicleta' ? 'fa-bicycle' :
                                      'fa-person-walking'
                                  }`}></i>
                              </div>
                              <div>
                                <h4 className="font-black text-stone-800 leading-none">{deliverer.name}</h4>
                                <p className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-wider">{deliverer.vehicleModel} • {deliverer.vehiclePlate}</p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${deliverer.status === 'Disponível' ? 'bg-green-100 text-green-600 border-green-200' :
                              deliverer.status === 'Em Rota' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                deliverer.status === 'Indisponível' ? 'bg-red-100 text-red-600 border-red-200' :
                                  'bg-stone-100 text-stone-400 border-stone-200'
                              }`}>
                              {deliverer.status}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-stone-50 p-3 rounded-2xl text-center">
                              <p className="text-[9px] font-black text-stone-400 uppercase tracking-wider">Entregas</p>
                              <p className="text-lg font-black text-stone-900">{deliverer.totalDeliveries}</p>
                            </div>
                            <div className="bg-stone-50 p-3 rounded-2xl text-center">
                              <p className="text-[9px] font-black text-stone-400 uppercase tracking-wider">Avaliação</p>
                              <p className="text-lg font-black text-orange-500 flex items-center justify-center gap-1">
                                {deliverer.rating || '5.0'} <i className="fas fa-star text-[10px]"></i>
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingDeliverer(deliverer);
                                setDelivererForm({
                                  name: deliverer.name,
                                  phone: deliverer.phone,
                                  cpf: deliverer.cpf,
                                  vehicleType: deliverer.vehicleType,
                                  vehicleModel: deliverer.vehicleModel,
                                  vehiclePlate: deliverer.vehiclePlate,
                                  vehicleColor: deliverer.vehicleColor,
                                  status: deliverer.status,
                                  maxOrders: deliverer.maxOrders,
                                  photoUrl: deliverer.photoUrl,
                                  isActive: deliverer.isActive
                                });
                              }}
                              className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-stone-800 transition-all"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteDeliverer(deliverer.id)}
                              className="px-4 bg-stone-100 text-stone-400 rounded-xl hover:bg-red-100 hover:text-red-500 transition-all"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'marketing' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-stone-100 pb-8 gap-4">
              <h3 className="text-2xl font-black uppercase text-stone-800 tracking-tight flex items-center gap-3">
                <i className="fas fa-bullhorn text-orange-500"></i>
                Central de Marketing
              </h3>
              <div className="flex items-center gap-4">
                <div className="bg-orange-100 text-orange-700 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                  {customers.length} Clientes na Base
                </div>
                <div className="bg-green-100 text-green-700 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                  {marketingSentSet.size} Enviados Hoje
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* CONFIGURAÇÃO DA MENSAGEM */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-stone-50 p-8 rounded-[2.5rem] border border-stone-100 sticky top-8">
                  <h4 className="text-lg font-black uppercase text-stone-900 mb-6 flex items-center gap-2">
                    <i className="fas fa-magic text-orange-500"></i>
                    Ações de Conteúdo
                  </h4>
                  <button
                    disabled={isGeneratingPoster}
                    onClick={async () => {
                      const menuElement = document.getElementById('menu-poster');
                      if (!menuElement) return;

                      try {
                        setIsGeneratingPoster(true);

                        // 1. Forçar visibilidade e posição real para o browser processar o layout
                        menuElement.style.display = 'flex';
                        menuElement.style.opacity = '1';
                        menuElement.style.visibility = 'visible';
                        menuElement.style.position = 'fixed';
                        menuElement.style.left = '0';
                        menuElement.style.top = '0';
                        menuElement.style.zIndex = '-9999';

                        // 2. Aguarda um tempo maior para garantir o reflow completo
                        await new Promise(r => setTimeout(r, 1000));

                        // 3. Captura com configurações de alta qualidade
                        const dataUrl = await toPng(menuElement, {
                          cacheBust: true,
                          backgroundColor: '#1c1917',
                          width: 600,
                          pixelRatio: 2,
                          style: {
                            display: 'flex',
                            opacity: '1',
                            visibility: 'visible',
                            position: 'fixed',
                            left: '0',
                            top: '0'
                          }
                        });

                        // 4. Salva e Trata o Download
                        await db.saveMarketingPoster(dataUrl);
                        setLastGeneratedPoster(dataUrl);

                        const link = document.createElement('a');
                        link.download = `Cardapio_${new Date().toISOString().split('T')[0]}.png`;
                        link.href = dataUrl;
                        link.click();

                        showToast('Imagem gerada e salva no banco de dados!');
                      } catch (err) {
                        console.error("Erro na geração:", err);
                        alert("Houve um erro na captura da imagem. Verifique se há pratos ativos no cardápio de hoje.");
                      } finally {
                        if (menuElement) {
                          menuElement.style.display = 'none';
                          menuElement.style.opacity = '0';
                          menuElement.style.visibility = 'hidden';
                          menuElement.style.left = '-9999px';
                          menuElement.style.position = 'absolute';
                        }
                        setIsGeneratingPoster(false);
                      }
                    }}
                    className={`w-full ${isGeneratingPoster ? 'bg-stone-400' : 'bg-orange-600 hover:bg-orange-700'} text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-100 transition-all mb-8 flex items-center justify-center gap-3`}
                  >
                    <i className={`fas ${isGeneratingPoster ? 'fa-spinner fa-spin' : 'fa-magic'} text-lg`}></i>
                    {isGeneratingPoster ? 'Processando Arte...' : 'Gerar e Salvar Arte Atual'}
                  </button>

                  {/* Visualização da Última Arte */}
                  {lastGeneratedPoster && (
                    <div className="mb-8 space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-stone-400 ml-4 tracking-widest">Última Arte Salva</h4>
                      <div className="relative group rounded-[2rem] overflow-hidden border-2 border-orange-100 shadow-md">
                        <img src={lastGeneratedPoster} className="w-full h-auto" alt="Último Cardápio" />
                        <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                          <a
                            href={lastGeneratedPoster}
                            download={`Cardapio_Salvo.png`}
                            className="bg-white text-stone-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all"
                          >
                            <i className="fas fa-download mr-2"></i> Baixar
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <h4 className="text-lg font-black uppercase text-stone-900 mb-6 flex items-center gap-2">
                    <i className="fas fa-comment-dots text-orange-500"></i>
                    Mensagem Padrão
                  </h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase mb-4 leading-relaxed">
                    Use <span className="text-orange-600">{`{nome}`}</span>, <span className="text-orange-600">{`{link}`}</span> e <span className="text-orange-600">{`{cardapio}`}</span> para preencher automaticamente.
                  </p>
                  <textarea
                    value={marketingMessage}
                    onChange={(e) => setMarketingMessage(e.target.value)}
                    className="w-full h-80 p-6 bg-white rounded-3xl border-2 border-white focus:border-orange-500 outline-none font-bold text-stone-700 text-xs shadow-sm shadow-inner transition-all resize-none"
                    placeholder="Escreva sua mensagem aqui..."
                  />
                  <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[9px] text-orange-700 font-bold uppercase tracking-wider mb-1">Dica de Conversão:</p>
                    <p className="text-[9px] text-orange-600 leading-normal">
                      Mantenha a mensagem curta e amigável. Use emojis para destacar o link. O link redireciona direto para o seu cardápio!
                    </p>
                  </div>
                </div>
              </div>

              {/* LISTA DE CLIENTES E FILTROS */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 w-full relative">
                    <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-stone-300"></i>
                    <input
                      type="text"
                      placeholder="Buscar por nome ou telefone..."
                      value={searchCustomer}
                      onChange={(e) => setSearchCustomer(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-stone-50 rounded-2xl border-none outline-none font-bold text-xs"
                    />
                  </div>
                  <div className="relative w-full md:w-auto">
                    <i className="fas fa-filter absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 z-10"></i>
                    <select
                      value={marketingNeighborhoodFilter}
                      onChange={(e) => setMarketingNeighborhoodFilter(e.target.value)}
                      className="w-full md:w-56 pl-14 pr-10 py-4 bg-stone-50 rounded-2xl border-none outline-none font-black uppercase text-[10px] appearance-none cursor-pointer relative"
                    >
                      <option value="Todos">Todos os Bairros</option>
                      {bairros.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none"></i>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customers
                    .filter(c => {
                      const matchesSearch = (c.name || '').toLowerCase().includes(searchCustomer.toLowerCase()) || (c.phone || '').includes(searchCustomer);
                      const matchesNeighborhood = marketingNeighborhoodFilter === 'Todos' || c.neighborhood === marketingNeighborhoodFilter;
                      return matchesSearch && matchesNeighborhood;
                    })
                    .map(customer => {
                      const isSent = marketingSentSet.has(customer.phone);
                      return (
                        <div key={customer.phone} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all ${isSent ? 'bg-green-100 text-green-600 scale-90' : 'bg-stone-50 text-stone-300 group-hover:bg-orange-50 group-hover:text-orange-500'}`}>
                              <i className={isSent ? 'fas fa-check' : 'fas fa-user'}></i>
                            </div>
                            <div>
                              <h5 className="font-black text-stone-800 text-sm uppercase tracking-tighter truncate max-w-[150px]">{customer.name}</h5>
                              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{customer.neighborhood}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendMarketing(customer)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSent ? 'bg-stone-100 text-stone-400 cursor-default' : 'bg-[#25D366] text-white shadow-lg shadow-green-100 hover:scale-110 active:scale-95'}`}
                          >
                            <i className="fab fa-whatsapp text-xl"></i>
                          </button>
                        </div>
                      );
                    })
                  }
                  {customers.length === 0 && (
                    <div className="col-span-full py-24 text-center text-stone-300 font-black uppercase tracking-widest bg-stone-50 rounded-[4rem] border-2 border-dashed border-stone-200">
                      <i className="fas fa-users-slash text-4xl mb-4 block"></i>
                      Nenhum cliente na base
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE UPLOAD DE LOGO */}

        {
          showLogoModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 text-center shadow-2xl relative">
                <button onClick={() => { setShowLogoModal(false); setTempLogo(null); }} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-8">Atualizar Logomarca</h3>

                <div className="w-48 h-48 bg-stone-50 rounded-[3rem] mx-auto mb-10 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                  {tempLogo || config?.logoUrl ? (
                    <img src={tempLogo || config?.logoUrl} className="w-full h-full object-cover" />
                  ) : (
                    <i className="fas fa-cloud-arrow-up text-5xl text-stone-200"></i>
                  )}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-stone-900/0 group-hover:bg-stone-900/40 transition-all opacity-0 group-hover:opacity-100">
                    <span className="text-white font-black uppercase text-[10px] tracking-widest">Escolher Arquivo</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>

                <div className="space-y-4">
                  {tempLogo && (
                    <button onClick={confirmLogoUpdate} className="w-full bg-green-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all">Confirmar Alteração</button>
                  )}
                  <button onClick={() => { setShowLogoModal(false); setTempLogo(null); }} className="w-full bg-stone-100 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL DE EDIÇÃO DE CLIENTE */}
        {
          editingCustomer && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
              <div className="bg-white w-full max-w-xl rounded-[3.5rem] p-12 shadow-2xl relative">
                <button onClick={() => setEditingCustomer(null)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-8">Editar Cliente</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Nome do Cliente</label>
                    <input type="text" value={editingCustomer.name} onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Telefone (ID)</label>
                    <input type="text" readOnly value={editingCustomer.phone} className="w-full p-4 rounded-2xl border-2 border-stone-100 bg-stone-100 outline-none font-bold text-stone-400 cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Rua / Av.</label>
                    <input type="text" value={editingCustomer.street} onChange={e => setEditingCustomer({ ...editingCustomer, street: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Número</label>
                    <input type="text" value={editingCustomer.number} onChange={e => setEditingCustomer({ ...editingCustomer, number: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">Bairro</label>
                    <select
                      value={editingCustomer.neighborhood}
                      onChange={e => setEditingCustomer({ ...editingCustomer, neighborhood: e.target.value })}
                      className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 shadow-inner"
                    >
                      <option value="">Selecione...</option>
                      {bairros.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 ml-4">CEP</label>
                    <input type="text" value={editingCustomer.cep} onChange={e => setEditingCustomer({ ...editingCustomer, cep: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-stone-50 bg-stone-50 outline-none font-bold focus:border-orange-500 shadow-inner" />
                  </div>
                </div>

                <div className="flex gap-4 mt-10">
                  <button
                    onClick={handleSaveCustomer}
                    disabled={isSaving}
                    className={`flex-1 ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-green-600'} text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] transition-all shadow-2xl ${!isSaving && 'hover:scale-[1.02] active:scale-95'}`}
                  >
                    {isSaving ? <i className="fas fa-spinner animate-spin"></i> : 'Salvar Alterações'}
                  </button>
                  <button onClick={() => setEditingCustomer(null)} className="flex-1 bg-stone-100 text-stone-400 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL DE HISTÓRICO DE PEDIDOS POR CLIENTE */}
        {
          viewingCustomerOrders && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
              <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[3.5rem] p-10 shadow-2xl relative flex flex-col">
                <button onClick={() => setViewingCustomerOrders(null)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>

                <div className="mb-8">
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-1">Histórico de Pedidos</h3>
                  <p className="text-stone-400 font-bold uppercase text-xs tracking-widest">{viewingCustomerOrders.name}</p>
                  <p className="text-orange-500 font-bold text-[10px] tracking-widest mt-1"><i className="fab fa-whatsapp"></i> {viewingCustomerOrders.phone}</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 -mr-2 scrollbar-hide">
                  {orders.filter(o => o.customerPhone.replace(/\D/g, '') === viewingCustomerOrders.phone.replace(/\D/g, '')).length === 0 ? (
                    <div className="text-center py-20 text-stone-300 font-black uppercase tracking-widest">Nenhum pedido encontrado</div>
                  ) : (
                    orders.filter(o => o.customerPhone.replace(/\D/g, '') === viewingCustomerOrders.phone.replace(/\D/g, ''))
                      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
                      .map(order => (
                        <div key={order.id} className="p-6 rounded-[2rem] bg-stone-50 border border-stone-100 flex justify-between items-center group hover:bg-white hover:border-orange-200 transition-all">
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-[9px] font-black bg-stone-200 text-stone-600 px-3 py-1 rounded-full tracking-wider">{new Date(order.createdAt || '').toLocaleDateString('pt-BR')} • {new Date(order.createdAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${['Finalizado'].includes(order.status) ? 'bg-green-100 text-green-600' : ['Cancelado'].includes(order.status) ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{order.status}</span>
                              <span className="text-[9px] font-black text-stone-300">#{order.id.slice(-4)}</span>
                            </div>
                            <p className="text-[11px] font-bold text-stone-700 leading-tight mb-2 line-clamp-2">{order.items.map(i => `${i.quantity}x ${i.marmita.name}`).join(', ')}</p>
                            <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest flex items-center gap-4">
                              <span>Produtos: <span className="text-stone-900">R$ {order.subtotal.toFixed(2)}</span></span>
                              <span>Taxa: <span className="text-stone-900">R$ {order.deliveryFee.toFixed(2)}</span></span>
                              <span className="ml-auto text-xs text-orange-600">Total: R$ {order.total.toFixed(2)}</span>
                            </p>
                          </div>
                          <button onClick={() => handleManualPrint(order)} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-all shadow-md border border-stone-100">
                            <i className="fas fa-print text-xl"></i>
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )
        }

        {/* SISTEMA DE TOAST CUSTOMIZADO */}
        {toast && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[1000] animate-modal-in">
            <div className={`px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border ${toast.type === 'success' ? 'bg-green-500 border-green-400' : 'bg-red-500 border-red-400'} text-white`}>
              <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`}></i>
              <span className="font-black uppercase text-xs tracking-widest">{toast.msg}</span>
            </div>
          </div>
        )}

        <style>{`
        .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
        {/* MODAL DE ATRIBUIÇÃO DE ENTREGADOR */}
        {showAssignModal && orderToAssign && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/90 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 shadow-2xl relative">
              <button onClick={() => setShowAssignModal(false)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900"><i className="fas fa-times text-xl"></i></button>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 mb-2">Despachar Pedido</h3>
              <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest mb-8">Pedido #{orderToAssign.id.slice(-4)} • {orderToAssign.customerName}</p>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {deliverers.filter(d => d.isActive && d.status === 'Disponível').length === 0 ? (
                  <div className="py-10 text-center text-stone-300 font-black uppercase text-xs">Nenhum entregador disponível</div>
                ) : deliverers.filter(d => d.isActive && d.status === 'Disponível').map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleAssignDeliverer(d.id, d.name)}
                    className="w-full flex items-center gap-4 p-5 rounded-3xl bg-stone-50 border border-stone-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                      <i className="fas fa-motorcycle text-xl"></i>
                    </div>
                    <div>
                      <p className="font-black text-stone-800 uppercase text-xs">{d.name}</p>
                      <p className="text-[10px] text-stone-400 font-bold">{d.vehicleType} • {d.vehiclePlate}</p>
                    </div>
                    <i className="fas fa-chevron-right ml-auto text-stone-300"></i>
                  </button>
                ))}
              </div>

              <button onClick={() => setShowAssignModal(false)} className="w-full mt-8 bg-stone-100 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
            </div>
          </div>
        )}

        {/* Modal de Gerenciamento de Opcionais */}
        {showOpcionalModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl shadow-stone-900/20 flex flex-col max-h-[90vh] animate-modal-in overflow-hidden relative">
              <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900">Gerenciar Opcionais</h3>
                <button
                  onClick={() => {
                    setShowOpcionalModal(false);
                    setEditingGrupo(null);
                    setGrupoForm({ nome: '', minSelecao: 0, maxSelecao: 1 });
                  }}
                  className="w-12 h-12 bg-white rounded-2xl shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all text-stone-400"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <style>{modalStyles}</style>
                {/* Formulário de Grupo */}
                <div className="bg-orange-50/50 p-6 rounded-[2rem] border border-orange-100 space-y-4">
                  <h4 className="text-xs font-black uppercase text-orange-600 px-2">
                    {editingGrupo ? 'Editar Grupo' : 'Novo Grupo de Escolha'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-stone-400 ml-3">Nome (Ex: Escolha o Feijão)</label>
                      <input
                        type="text"
                        value={grupoForm.nome}
                        onChange={e => setGrupoForm({ ...grupoForm, nome: e.target.value })}
                        className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-orange-500 outline-none font-bold shadow-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-stone-400 ml-3">Min.</label>
                        <input
                          type="number"
                          value={grupoForm.minSelecao}
                          onChange={e => setGrupoForm({ ...grupoForm, minSelecao: parseInt(e.target.value) })}
                          className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-orange-500 outline-none font-bold shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-stone-400 ml-3">Max.</label>
                        <input
                          type="number"
                          value={grupoForm.maxSelecao}
                          onChange={e => setGrupoForm({ ...grupoForm, maxSelecao: parseInt(e.target.value) })}
                          className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-orange-500 outline-none font-bold shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveGrupo}
                      disabled={isSaving}
                      className={`flex-1 ${isSaving ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-900 hover:bg-orange-600'} text-white font-black uppercase text-[10px] py-4 rounded-2xl transition-all shadow-lg ${!isSaving && 'active:scale-95'}`}
                    >
                      {isSaving ? <i className="fas fa-spinner animate-spin"></i> : (editingGrupo ? 'Atualizar Grupo' : 'Cadastrar Grupo')}
                    </button>
                    {editingGrupo && (
                      <button
                        onClick={() => {
                          setEditingGrupo(null);
                          setGrupoForm({ nome: '', minSelecao: 0, maxSelecao: 1 });
                        }}
                        className="p-4 bg-white text-stone-400 rounded-2xl hover:text-red-500 shadow-sm transition-all"
                      >
                        <i className="fas fa-undo"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de Grupos */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-stone-400 px-2 tracking-widest">Grupos Existentes</h4>
                  <div className="space-y-4">
                    {gruposOpcionais.map(g => (
                      <div key={g.id} className="bg-stone-50 rounded-[2.5rem] border border-stone-100 p-6 space-y-4 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-black uppercase text-stone-900">{g.nome}</p>
                            <p className="text-[9px] font-bold text-stone-400 uppercase">Min: {g.minSelecao} | Max: {g.maxSelecao}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingGrupo(g);
                                setGrupoForm({ nome: g.nome, minSelecao: g.minSelecao, maxSelecao: g.maxSelecao });
                              }}
                              className="w-8 h-8 rounded-full bg-white text-stone-400 hover:text-orange-500 shadow-sm flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-edit text-[10px]"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteGrupo(g.id)}
                              className="w-8 h-8 rounded-full bg-white text-stone-400 hover:text-red-500 shadow-sm flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-trash text-[10px]"></i>
                            </button>
                          </div>
                        </div>

                        {/* Opcionais do Grupo */}
                        <div className="pl-4 border-l-2 border-stone-200 space-y-2">
                          {g.opcionais.map(opt => (
                            <div key={opt.id} className="flex justify-between items-center bg-white/50 p-2 rounded-xl group/opt">
                              <div className="flex items-center gap-3">
                                {opt.imageUrl ? (
                                  <img src={opt.imageUrl} alt={opt.nome} className="w-8 h-8 rounded-lg object-cover shadow-sm bg-stone-100" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-300">
                                    <i className="fas fa-image text-[10px]"></i>
                                  </div>
                                )}
                                <span className={`text-[10px] font-bold uppercase ${opt.disponivel ? 'text-stone-600' : 'text-stone-300 line-through'}`}>
                                  {opt.nome} (+ R$ {opt.precoAdicional.toFixed(2)})
                                </span>
                                {opt.gerenciarEstoque && (
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ml-2 ${opt.estoqueAtual && opt.estoqueAtual > 0 ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                                    Estoque: {opt.estoqueAtual}
                                  </span>
                                )}
                                {!opt.disponivel && (
                                  <span className="text-[7px] font-black bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-md uppercase ml-1">Indisponível</span>
                                )}
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover/opt:opacity-100 transition-all">
                                <button
                                  onClick={() => {
                                    setEditingOpcional(opt);
                                    setOpcionalForm({
                                      nome: opt.nome,
                                      precoAdicional: opt.precoAdicional,
                                      disponivel: opt.disponivel,
                                      imageUrl: opt.imageUrl || '',
                                      gerenciarEstoque: opt.gerenciarEstoque || false,
                                      estoqueAtual: opt.estoqueAtual || 0
                                    });
                                    setIsAddingOpcional(g.id);
                                  }}
                                  className="text-stone-300 hover:text-blue-500"
                                >
                                  <i className="fas fa-edit text-[10px]"></i>
                                </button>
                                <button
                                  onClick={() => handleToggleOpcionalDisponibilidade(opt)}
                                  className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-all ${opt.disponivel ? 'bg-green-50 text-green-500 hover:bg-green-100' : 'bg-stone-50 text-stone-300 hover:bg-green-50 hover:text-green-500'}`}
                                  title={opt.disponivel ? "Marcar como Indisponível" : "Marcar como Disponível"}
                                >
                                  <i className={`fas ${opt.disponivel ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`}></i>
                                </button>
                                <button onClick={() => handleDeleteOpcional(opt.id)} className="text-stone-300 hover:text-red-500">
                                  <i className="fas fa-times-circle text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          ))}

                          {isAddingOpcional === g.id ? (
                            <div className="pt-2 flex flex-col gap-3 p-4 bg-white/50 rounded-2xl border border-stone-100 shadow-sm animate-fade-in">
                              <h4 className="text-[9px] font-black uppercase text-stone-400 px-2 tracking-widest">
                                {editingOpcional ? 'Editando Opcional' : 'Novo Opcional'}
                              </h4>
                              <div className="flex flex-col md:flex-row gap-4 items-start">
                                <div className="relative group">
                                  <div className="w-20 h-20 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden shadow-inner cursor-pointer">
                                    {opcionalForm.imageUrl ? (
                                      <img src={opcionalForm.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                      <i className="fas fa-camera text-stone-300 text-xl"></i>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            setOpcionalForm({ ...opcionalForm, imageUrl: reader.result as string });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </div>
                                  {opcionalForm.imageUrl && (
                                    <button
                                      onClick={() => setOpcionalForm({ ...opcionalForm, imageUrl: '' })}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  )}
                                </div>
                                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="col-span-1 sm:col-span-2">
                                    <input
                                      type="text"
                                      placeholder="Nome (Ex: Feijão Preto)"
                                      value={opcionalForm.nome}
                                      onChange={e => setOpcionalForm({ ...opcionalForm, nome: e.target.value })}
                                      className="w-full p-3 bg-white rounded-xl border border-stone-100 outline-none text-[10px] font-black uppercase text-stone-800 shadow-sm focus:border-orange-500"
                                    />
                                  </div>
                                  <input
                                    type="number"
                                    placeholder="Preço (0.00)"
                                    value={opcionalForm.precoAdicional}
                                    onChange={e => setOpcionalForm({ ...opcionalForm, precoAdicional: parseFloat(e.target.value) })}
                                    className="w-full p-3 bg-white rounded-xl border border-stone-100 outline-none text-[10px] font-black uppercase text-orange-600 shadow-sm focus:border-orange-500"
                                  />
                                  <div className="col-span-1 sm:col-span-2 flex items-center gap-4 bg-white/30 p-2 rounded-xl border border-stone-100">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={opcionalForm.gerenciarEstoque}
                                        onChange={e => setOpcionalForm({ ...opcionalForm, gerenciarEstoque: e.target.checked })}
                                        className="w-4 h-4 accent-orange-500 rounded"
                                      />
                                      <span className="text-[9px] font-black uppercase text-stone-400">Controlar Estoque?</span>
                                    </label>
                                    {opcionalForm.gerenciarEstoque && (
                                      <div className="flex-1 flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase text-stone-400">Qtd:</span>
                                        <input
                                          type="number"
                                          value={opcionalForm.estoqueAtual}
                                          onChange={e => setOpcionalForm({ ...opcionalForm, estoqueAtual: parseInt(e.target.value) })}
                                          className="w-full p-2 bg-white rounded-lg border border-stone-100 outline-none text-[10px] font-black text-blue-600"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveOpcional(g.id)}
                                  disabled={isSaving}
                                  className={`flex-1 ${isSaving ? 'bg-stone-400 cursor-not-allowed' : editingOpcional ? 'bg-blue-600' : 'bg-green-500'} text-white font-black uppercase text-[9px] py-2 rounded-xl transition-colors`}
                                >
                                  {isSaving ? <i className="fas fa-spinner animate-spin"></i> : (editingOpcional ? 'Atualizar' : 'Adicionar')}
                                </button>
                                <button
                                  onClick={() => {
                                    setIsAddingOpcional(false);
                                    setEditingOpcional(null);
                                    setOpcionalForm({ nome: '', precoAdicional: 0, disponivel: true, imageUrl: '', gerenciarEstoque: false, estoqueAtual: 0 });
                                  }}
                                  className="px-4 bg-stone-200 text-stone-500 font-black uppercase text-[9px] py-2 rounded-xl"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setIsAddingOpcional(g.id);
                                setOpcionalForm({ nome: '', precoAdicional: 0, disponivel: true, imageUrl: '', gerenciarEstoque: false, estoqueAtual: 0 });
                              }}
                              className="text-[9px] font-black uppercase text-stone-400 hover:text-stone-600 flex items-center gap-2 pt-1"
                            >
                              <i className="fas fa-plus-circle"></i> Novo Item Opcional
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {gruposOpcionais.length === 0 && (
                      <p className="text-center py-20 text-[10px] font-bold text-stone-300 uppercase">Nenhum grupo cadastrado</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTAINER INVISÍVEL PARA GERAÇÃO DA ARTE DO CARDÁPIO */}
      <div
        id="menu-poster"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '600px',
          padding: '40px',
          background: '#1c1917', // stone-900
          display: 'none', // O onClick vai mudar para flex
          flexDirection: 'column',
          alignItems: 'center',
          opacity: 0,
          zIndex: -1,
          pointerEvents: 'none'
        }}
      >
        <div className="flex flex-col items-center mb-12 text-center w-full">
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              style={{ border: '4px solid #f97316' }}
              className="w-24 h-24 rounded-3xl object-cover mb-6"
              alt="Logo"
            />
          ) : (
            <div style={{ background: '#f97316' }} className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6">
              <i style={{ color: '#ffffff' }} className="fas fa-utensils text-4xl"></i>
            </div>
          )}
          <h2 style={{ color: '#ffffff' }} className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Cardápio do Dia</h2>
          <p style={{ color: '#f97316' }} className="font-black uppercase tracking-[0.3em] text-sm">{config?.businessName || 'Panelas da Vanda'}</p>
          <div style={{ background: '#f97316' }} className="w-20 h-1 mt-6 rounded-full"></div>
        </div>

        <div className="w-full space-y-6">
          {currentDayMenu.length === 0 ? (
            <div style={{ border: '2px dashed #292524' }} className="text-center py-20 rounded-[3rem]">
              <p style={{ color: '#78716c' }} className="font-bold uppercase tracking-widest text-xs">Menu em manutenção</p>
            </div>
          ) : currentDayMenu.map(item => (
            <div key={item.id} style={{ background: 'rgba(41, 37, 36, 0.5)', border: '1px solid #292524' }} className="flex items-center gap-6 p-6 rounded-[2.5rem]">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  className="w-20 h-20 rounded-2xl object-cover"
                  alt=""
                />
              )}
              <div className="flex-1">
                <h4 style={{ color: '#ffffff' }} className="font-black uppercase text-lg leading-tight mb-1">{item.name}</h4>
                <p style={{ color: '#a8a29e' }} className="text-xs font-bold leading-tight line-clamp-2">{item.description}</p>
              </div>
              <div className="text-right">
                <span style={{ background: '#f97316', color: '#ffffff' }} className="px-4 py-2 rounded-xl font-black text-sm">
                  R$ {item.price.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center w-full border-t border-white/10 pt-8">
          <p style={{ color: '#a8a29e' }} className="font-black uppercase tracking-[0.2em] text-[10px] mb-2">Peça agora em:</p>
          <p style={{ color: '#ffffff' }} className="font-black text-2xl tracking-tight uppercase">
            {config?.businessName || 'Panelas da Vanda'}
          </p>
        </div>
      </div>
    </div >
  );
};

export default Admin;
