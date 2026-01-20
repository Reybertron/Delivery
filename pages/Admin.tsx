import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Marmita, DayOfWeek, Neighborhood, Customer, Order, AppConfig, OrderStatus, CashMovement } from '../types';
import { DAYS_LIST } from '../constants';
import { db } from '../services/database';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type AdminTab = 'pedidos' | 'caixa' | 'menu' | 'bairros' | 'clientes' | 'config';

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

  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchOrderPhone, setSearchOrderPhone] = useState('');

  // Estados do Menu
  const [editingMarmita, setEditingMarmita] = useState<Marmita | null>(null);
  const [marmitaForm, setMarmitaForm] = useState<Omit<Marmita, 'id'>>({
    name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: ''
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

  useEffect(() => {
    const init = async () => {
      try {
        const cfg = await db.getConfig();
        setConfig(cfg);
        setDbStatus('Online');
        if (!cfg.adminPassword) setIsAuthorized(true);
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
      if (config?.autoPrint && orders.length > 0) {
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
      const [m, b, o, c] = await Promise.all([
        db.getMenu(), db.getBairros(), db.getOrders(), db.getAllCustomers()
      ]);
      setMenu(Array.isArray(m) ? m : []);
      setBairros(Array.isArray(b) ? b : []);
      setOrders(Array.isArray(o) ? o : []);
      setCustomers(Array.isArray(c) ? c : []);

      const movementsData = await db.getCashMovements(globalDate);
      setMovements(movementsData);

      setDbStatus('Online');
    } catch (e) {
      console.error("Erro na sincronização de dados");
      setDbStatus('Offline');
    }
  };

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
    try {
      await db.addCashMovement(movForm);
      setMovForm({ tipo: 'Saída', categoria: 'Insumos', descricao: '', valor: 0 });
      refreshData();
    } catch (e) {
      alert("Erro ao salvar movimentação");
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
    try {
      if (editingMarmita) await db.updateMarmita(editingMarmita.id, marmitaForm);
      else await db.saveMarmita(marmitaForm);
      setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '' });
      setEditingMarmita(null);
      refreshData();
      alert("Prato salvo com sucesso!");
    } catch (e) { alert("Erro ao salvar marmita"); }
  };

  const handleSaveBairro = async () => {
    if (!bairroForm.name) return alert('Nome do bairro obrigatório');
    try {
      await db.saveBairro(bairroForm);
      setBairroForm({ name: '', deliveryFee: 0 });
      setIsEditingBairro(false);
      refreshData();
      alert("Taxa atualizada!");
    } catch (e) { alert("Erro ao salvar bairro"); }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    try {
      await db.saveCustomer(editingCustomer);
      setEditingCustomer(null);
      refreshData();
      alert("Dados do cliente atualizados com sucesso!");
    } catch (e) { alert("Erro ao atualizar cliente"); }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await db.saveConfig(config);
      alert("Configurações salvas!");
      window.location.reload();
    } catch (e) { alert("Erro ao salvar configurações"); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (config && passwordInput === config.adminPassword) setIsAuthorized(true);
    else alert('Senha Administrativa Inválida');
  };

  const getOrderHtml = (order: Order) => {
    const itemsHtml = Array.isArray(order.items)
      ? order.items.map(i => `<div class="item-row"><span>${i.quantity}x ${i.marmita?.name || 'Item'}</span><span>R$${((i.quantity || 1) * (i.marmita?.price || 0)).toFixed(2)}</span></div>`).join('')
      : '<div>Nenhum item detalhado</div>';

    const dateStr = new Date(order.createdAt).toLocaleString('pt-BR');

    return `
      <html>
      <head>
        <title>Pedido #${order.id.slice(-4)}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 5px; font-size: 13px; color: #000; font-weight: bold; background: #fff; }
          .header { text-align: center; margin-bottom: 10px; }
          .header h3 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
          .header p { margin: 2px 0; font-size: 14px; }
          .divider { border-top: 2px dashed #000; margin: 10px 0; }
          .label { font-weight: 900; font-size: 14px; }
          .total-row { font-size: 16px; font-weight: 900; margin-top: 10px; display: flex; justify-content: space-between; border-top: 2px solid #000; pt: 5px; }
          .item-list { margin: 10px 0; }
          .info-block { margin-bottom: 8px; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; }
          .obs-box { border: 1px solid #000; padding: 5px; margin-top: 10px; font-size: 11px; }
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

        <div style="display:flex; justify-content:space-between;">
            <span>Forma Pagto:</span>
            <span>${order.paymentMethod}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Subtotal:</span>
            <span>R$ ${order.subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Taxa Entrega:</span>
            <span>R$ ${(order.deliveryFee || 0).toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="total-row">
            <span>TOTAL A PAGAR:</span>
            <span style="font-size:16px;">R$ ${(order.total || 0).toFixed(2)}</span>
        </div>
        
        <br>
        <div style="text-align:center; font-size:10px;">
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
          <button className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase hover:bg-orange-600 transition-all shadow-xl shadow-stone-200">Acessar Painel</button>
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
            </p>
          </div>
        </div>

        <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-stone-200 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'pedidos', icon: 'fa-clipboard-list', label: 'Pedidos' },
            { id: 'caixa', icon: 'fa-chart-pie', label: 'Financeiro' },
            { id: 'menu', icon: 'fa-utensils', label: 'Cardápio' },
            { id: 'bairros', icon: 'fa-truck-fast', label: 'Bairros' },
            { id: 'clientes', icon: 'fa-address-book', label: 'Clientes' },
            { id: 'config', icon: 'fa-sliders', label: 'Config' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-900'}`}
            >
              <i className={`fas ${tab.icon}`}></i>
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

                    <div className="flex gap-3">
                      <button onClick={() => printOrder(order)} className="flex-1 bg-white border-2 border-stone-100 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-stone-50 transition-all shadow-sm"><i className="fas fa-print mr-2"></i>Imprimir</button>
                      <select value={order.status} onChange={e => db.updateOrderStatus(order.id, e.target.value as any).then(refreshData)} className="flex-1 bg-stone-900 text-white py-3 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 ring-orange-500/20 cursor-pointer">
                        {['Pendente', 'Impresso', 'Preparo', 'Entrega', 'Finalizado', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
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
                    <button onClick={() => printOrder(order)} className="w-full bg-white border border-stone-200 py-2 rounded-xl text-[9px] font-black uppercase text-stone-400 hover:text-stone-900 transition-all">Reimprimir</button>
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
                      className="w-full bg-stone-900 text-white py-4 rounded-2xl text-xs font-black uppercase hover:bg-orange-600 transition-all shadow-lg active:scale-95"
                    >
                      Efetivar Lançamento
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

                <button onClick={handleSaveMarmita} className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-orange-600 transition-all transform active:scale-95 mt-4 flex items-center justify-center gap-3">
                  <i className={`fas ${editingMarmita ? 'fa-save' : 'fa-plus-circle'} text-lg`}></i>
                  {editingMarmita ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                </button>
                {editingMarmita && (
                  <button onClick={() => {
                    setEditingMarmita(null);
                    setMarmitaForm({ name: '', description: '', price: 0, day: DayOfWeek.MONDAY, category: 'Executiva', imageUrl: '', prepTime: '' });
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
                <button onClick={handleSaveBairro} className="w-full bg-stone-900 text-white py-7 rounded-[2rem] font-black uppercase shadow-2xl hover:bg-orange-600 transition-all text-sm tracking-widest">
                  {isEditingBairro ? 'Atualizar Taxa' : 'Registrar Bairro'}
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

                <button onClick={handleSaveConfig} className="md:col-span-2 w-full bg-stone-900 text-white py-8 rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-orange-600 transition-all mt-8 text-lg tracking-widest flex items-center justify-center gap-4 group">
                  <i className="fas fa-save text-2xl group-hover:scale-110 transition-transform"></i>
                  Efetivar Configurações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
                <button onClick={handleSaveCustomer} className="flex-1 bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all shadow-xl">Salvar Alterações</button>
                <button onClick={() => setEditingCustomer(null)} className="flex-1 bg-stone-100 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL DE HISTÓRICO DE PEDIDOS POR CLIENTE */}
      {viewingCustomerOrders && (
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
                      <button onClick={() => printOrder(order)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-stone-300 hover:text-stone-900 hover:bg-stone-100 transition-all shadow-sm border border-stone-100">
                        <i className="fas fa-print"></i>
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div >
  );
};

export default Admin;
