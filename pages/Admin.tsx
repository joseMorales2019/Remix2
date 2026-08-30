import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../supabase';
import AliadoOrders from './AliadoOrders';
import { AdminAvatarPanel, AvataresAdminPanel } from '../components/AvatarSystem';
import { SystemRealtimeMetrics } from '../components/SystemRealtimeMetrics';
import { WebAnalyticsRealtime } from '../components/WebAnalyticsRealtime';

const Admin: React.FC<{ user: any }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'realtime_metrics' | 'web_analytics' | 'users' | 'disputes' | 'approvals' | 'active_loans' | 'verify_payments' | 'saving_vouchers' | 'active_savings' | 'return_vouchers' | 'validacion_pagos' | 'all_loans' | 'control_total' | 'control_global_pagos' | 'projects' | 'payment_requests' | 'store_admin' | 'orders_admin' | 'avatares'>(user?.profile_type === 'aliado' ? 'store_admin' : 'dashboard');
  const [stats, setStats] = useState({
    total_loans: 0,
    active_loans: 0,
    defaulted_loans: 0,
    total_disbursed: 0,
    total_savings: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [approvedLoans, setApprovedLoans] = useState<any[]>([]);
  const [activeLoansList, setActiveLoansList] = useState<any[]>([]);
  const [verifyPaymentsList, setVerifyPaymentsList] = useState<any[]>([]);
  const [savingVouchers, setSavingVouchers] = useState<any[]>([]);
  const [activeSavings, setActiveSavings] = useState<any[]>([]);
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [backingRelations, setBackingRelations] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [searchDui, setSearchDui] = useState('');
  const [selectedSavingIds, setSelectedSavingIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todo');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estados para Proyectos
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>('resumen');
  const [newProject, setNewProject] = useState<any>({
    name: '',
    cover_image_url: '',
    summary_vision: '',
    summary_problem: '',
    summary_solution: '',
    summary_business_model: '',
    summary_amount: 0,
    summary_use_of_funds: '',
    summary_roi: '',
    desc_mission: '',
    desc_vision: '',
    desc_values: '',
    desc_history: '',
    desc_stage: '',
    desc_legal_form: '',
    desc_location: '',
    market_size: '',
    market_target: '',
    market_trends: '',
    market_opportunity: '',
    comp_direct: '',
    comp_diff: '',
    prod_desc: '',
    prod_roadmap: '',
    prod_tech: '',
    team_profiles: '',
    team_advisors: '',
    team_org: '',
    model_revenue: '',
    model_equity: 0,
    model_pre_money: 0,
    model_post_money: 0,
    model_rights: '',
    model_exit: '',
    marketing_attraction: '',
    marketing_strategy: '',
    marketing_channels: '',
    ops_timeline: '',
    ops_resources: '',
    ops_risks: '',
    fin_use_funds: '',
    fin_projections: '',
    fin_break_even: '',
    fin_scenarios: '',
    legal_compliance: '',
    legal_assets: '',
    legal_fintech: '',
    legal_contracts: '',
    legal_kyc: '',
    legal_taxes: '',
    risks_reg: '',
    risks_market: '',
    risks_ops: '',
    risks_fin: '',
    risks_contingency: '',
    annexes: ''
  });

  // Estados para Tienda/Productos
  const [products, setProducts] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [productOrders, setProductOrders] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState<any>({
    name: '',
    description: '',
    stock: 0,
    price: 0,
    wompi_link: '',
    whatsapp_number: '50370914941',
    creator_id: '',
    is_visible: true,
    image_urls: ['', '', '', ''],
    category: 'Estilo de vida'
  });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const [showWompi, setShowWompi] = useState(() => {
    const saved = localStorage.getItem('newbank_show_wompi');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('newbank_show_wompi');
      setShowWompi(saved === null ? true : saved === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const calculateTotalDue = (loan: any) => {
    const baseAmount = 25;
    const interest = 5;
    let penalty = 0;
    const dueDate = new Date(loan.due_date);
    const now = new Date();
    if (now > dueDate) {
      const monthsDiff = (now.getFullYear() - dueDate.getFullYear()) * 12 + (now.getMonth() - dueDate.getMonth());
      penalty = (Math.max(0, monthsDiff) + 1) * 10;
    }
    return baseAmount + interest + penalty;
  };

  const calculateSavingTotal = (saving: any) => {
    if (!saving.approved_at) return saving.amount;
    const approvalDate = new Date(saving.approved_at);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - approvalDate.getFullYear()) * 12 + (now.getMonth() - approvalDate.getMonth());
    const interest = Math.max(0, monthsDiff) * 0.01 * saving.amount;
    return saving.amount + interest;
  };

  const calculateRealBalance = (saving: any) => {
    const baseTotal = calculateSavingTotal(saving);
    const amountUsed = backingRelations
      .filter(rel => rel.saving_id === saving.id)
      .reduce((acc, curr) => acc + curr.amount_used, 0);
    return baseTotal - amountUsed;
  };

  const handleToggleDuiVisibility = async (targetUser: any) => {
    const newHiddenStatus = !targetUser.is_hidden;
    setActionLoading(targetUser.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_hidden: newHiddenStatus })
        .eq('id', targetUser.id);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error("Error cambiando visibilidad de DUI:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotifyTransferEmail = (loan: any) => {
    const subject = encodeURIComponent(`Notificación de Desembolso - Préstamo #${loan.id.slice(0, 8).toUpperCase()}`);
    const dueDate = new Date(loan.due_date).toLocaleDateString();
    const body = encodeURIComponent(
      `Hola ${loan.user?.full_name},\n\n` +
      `Le informamos que se ha procesado y realizado con éxito la transferencia de su préstamo de $25.00 a la cuenta registrada:\n\n` +
      `INFORMACIÓN DEL DEPÓSITO:\n` +
      `- Banco: ${loan.user?.bank_name || 'N/A'}\n` +
      `- Cuenta: ${loan.user?.bank_account || 'N/A'}\n` +
      `- ID de Operación: ${loan.id}\n\n` +
      `DETALLES DE DEVOLUCIÓN Y COMPROMISO:\n` +
      `- Monto total a devolver: $30.00 (Capital + Interés)\n` +
      `- FECHA LÍMITE DE PAGO: ${dueDate}\n\n` +
      `CONSECUENCIAS POR INCUMPLIMIENTO (MORA):\n` +
      `- Recargo automático de $10.00 mensuales por cada mes de atraso.\n` +
      `- Reporte y publicación de su identidad en el Observatorio Público de Morosos de NewBank AI.\n` +
      `- Inhabilitación permanente de su cuenta y pérdida de confiabilidad comunitaria.\n\n` +
      `DOCUMENTACIÓN DE RESPALDO ASOCIADA:\n` +
      `- Foto DUI: ${loan.user?.dui_url}\n` +
      `- Foto Biométrica: ${loan.user?.profile_image_url}\n\n` +
      `Por favor, asegúrese de realizar su abono a tiempo para mantener su score de confianza.\n\n` +
      `Atentamente,\n` +
      `Administración NewBank AI`
    );
    window.location.href = `mailto:${loan.user?.email}?subject=${subject}&body=${body}`;
  };

  const handleInconsistencyEmail = (targetUser: any, context: string) => {
    const subject = encodeURIComponent(`Inconsistencia detectada en su cuenta - NewBank AI`);
    const body = encodeURIComponent(
      `Hola ${targetUser.full_name},\n\nSe ha detectado una inconsistencia relacionada con su ${context}. Por favor, revise su perfil en la plataforma o póngase en contacto con soporte para evitar restricciones en su cuenta.\n\nAtentamente,\nAdministración NewBank AI`
    );
    window.location.href = `mailto:${targetUser.email}?subject=${subject}&body=${body}`;
  };

  const handleApproveSaving = async (saving: any) => {
    setActionLoading(saving.id);
    try {
      const { error } = await supabase
        .from('savings')
        .update({ status: 'ACTIVE', approved_at: new Date().toISOString() })
        .eq('id', saving.id);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportSavingError = async (saving: any) => {
    const mailto = `mailto:${saving.user?.email}?subject=Inconsistencia en Reporte de Ahorro&body=${encodeURIComponent(
      `Hola ${saving.user?.full_name}, no hemos podido registrar tu ahorro por un monto de $${saving.amount} debido a que no se ha registrado esa transferencia o hay inconsistencia en el comprobante.`
    )}`;
    window.location.href = mailto;
  };

  const handleReturnSaving = async (saving: any) => {
    if (!confirm("¿Confirmar devolución de ahorro?")) return;
    setActionLoading(saving.id);
    try {
      const { error } = await supabase
        .from('savings')
        .update({ status: 'RETURNED' })
        .eq('id', saving.id);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyLoanPayment = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      const { error } = await supabase.from('loans').update({ status: 'VERIFIED' }).eq('id', loanId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProfileType = async (userId: string, newType: string) => {
    if (!userId) return;
    setActionLoading(userId + '-profile');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_type: newType })
        .eq('id', userId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGlobalReject = async (loan: any) => {
    if (!confirm("¿Marcar como NO Desembolsado? El préstamo volverá a estado 'PENDING'.")) return;
    setActionLoading(loan.id);
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'PENDING', payment_voucher_url: null })
        .eq('id', loan.id);
      
      if (error) throw error;

      await supabase.from('loan_savings_backing').delete().eq('loan_id', loan.id);

      const subject = encodeURIComponent("Inconsistencia en el registro de pago - NewBank AI");
      const body = encodeURIComponent(
        `Hola ${loan.user?.full_name},\n\nLe informamos que no se ha registrado el pago de su préstamo por un monto de $25.00, por lo cual continuara en estado de Desembolsado (PENDING).\n\nPor favor, asegúrese de realizar la transferencia y subir un comprobante válido para procesar su solicitud.\n\nAtentamente,\nAdministración NewBank AI`
      );
      window.location.href = `mailto:${loan.user?.email}?subject=${subject}&body=${body}`;
      
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (loan: any) => {
    if (!confirm("¿Rechazar este comprobante de pago? El préstamo volverá a estado 'Desembolsado' (APPROVED) para que el usuario pueda subir uno válido.")) return;
    setActionLoading(loan.id);
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'APPROVED', payment_voucher_url: null })
        .eq('id', loan.id);
      
      if (error) throw error;

      const subject = encodeURIComponent("Inconsistencia en el registro de pago - NewBank AI");
      const body = encodeURIComponent(
        `Hola ${loan.user?.full_name},\n\nLe informamos que no se ha registrado el pago de su préstamo por un monto de $25.00, por lo cual continuara en estado de Desembolsado.\n\nPor favor, cargue un comprobante de transferencia válido para procesar su cierre de deuda.\n\nAtentamente,\nAdministración NewBank AI`
      );
      window.location.href = `mailto:${loan.user?.email}?subject=${subject}&body=${body}`;
      
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaymentAsPaid = async (requestId: string) => {
    if (!confirm("¿Marcar esta solicitud como PAGADA?")) return;
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'PAID' })
        .eq('id', requestId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el estado.");
    } finally {
      setActionLoading(null);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { count: total } = await supabase.from('loans').select('*', { count: 'exact', head: true });
      const { count: active } = await supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED');
      const { count: defaulted } = await supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'DEFAULTED');
      const { data: disbursed } = await supabase.from('loans').select('amount').eq('status', 'APPROVED');
      const { data: allSavings } = await supabase.from('savings').select('*, user:profiles(*)');
      const { data: backings } = await supabase.from('loan_savings_backing').select('*');

      // Cargar proyectos
      const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projectsData) setProjects(projectsData);

      // Cargar productos y wishlist
      let { data: productsData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (productsData) {
        if (user?.profile_type === 'aliado') {
          productsData = productsData.filter(p => p.creator_id === user.id);
        }
        setProducts(productsData);
      }

      const { data: wishlistData } = await supabase.from('product_wishlist').select('*, user:profiles(*), product:products(*)');
      if (wishlistData) setWishlistItems(wishlistData);

      const { data: ordersData } = await supabase.from('product_orders').select('*, user:profiles(*), product:products(*)').order('created_at', { ascending: false });
      if (ordersData) setProductOrders(ordersData);

      if (backings) setBackingRelations(backings);

      const totalAmount = disbursed?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const totalActiveSavings = allSavings?.filter(s => s.status === 'ACTIVE' || s.status === 'RETURN_REQUESTED').reduce((acc, s) => acc + s.amount, 0) || 0;

      setStats({
        total_loans: total || 0,
        active_loans: active || 0,
        defaulted_loans: defaulted || 0,
        total_disbursed: totalAmount,
        total_savings: totalActiveSavings
      });

      setSavingVouchers(allSavings?.filter(s => s.status === 'PENDING') || []);
      setActiveSavings(allSavings?.filter(s => s.status === 'ACTIVE') || []);
      setReturnRequests(allSavings?.filter(s => s.status === 'RETURN_REQUESTED') || []);

      const { data: pRequests } = await supabase.from('payment_requests').select('*').order('created_at', { ascending: false });
      if (pRequests) setPaymentRequests(pRequests);

      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: allLoansWithUsers } = await supabase.from('loans').select('*, user:profiles(*)').order('created_at', { ascending: false });
      const { data: allRefs } = await supabase.from('community_references').select('*').eq('is_trustworthy', true);

      if (profiles && allLoansWithUsers) {
        setAllLoans(allLoansWithUsers);
        const usersWithStatus = profiles.map(profile => {
          const userLoans = allLoansWithUsers.filter(l => l.user_id === profile.id);
          const userRefs = allRefs?.filter(r => r.applicant_id === profile.id) || [];
          
          let status = 'Solvente';
          if (userLoans.some(l => l.status === 'DEFAULTED')) status = 'Moroso';
          else if (userLoans.some(l => l.status === 'APPROVED' || l.status === 'PENDING')) status = 'Pendiente';
          
          return { 
            ...profile, 
            calculated_status: status,
            is_verified: userRefs.length >= 5
          };
        });
        setUsers(usersWithStatus);

        setApprovedLoans(allLoansWithUsers.filter(l => l.status === 'PENDING' && l.user && (l.analysis_score || 0) >= 50));
        setActiveLoansList(allLoansWithUsers.filter(l => l.status === 'APPROVED' || l.status === 'DEFAULTED'));
        setVerifyPaymentsList(allLoansWithUsers.filter(l => l.status === 'PAID'));
      }
    } catch (err) {
      console.error("Error cargando datos administrativos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLoanWithSavings = async (loanId: string, amount: number) => {
    const selectedSavings = activeSavings.filter(s => selectedSavingIds.includes(s.id));
    const totalSelectedAvailable = selectedSavings.reduce((acc, s) => acc + calculateRealBalance(s), 0);

    if (totalSelectedAvailable < amount) {
      alert(`Los ahorros seleccionados (Saldo Real Disponible: $${totalSelectedAvailable.toFixed(2)}) no cubren el monto del préstamo ($${amount}). Selecciona más ahorros.`);
      return;
    }

    if (stats.total_savings <= 0) {
      alert("No se pueden realizar préstamos si no hay ahorros activos en el banco.");
      return;
    }

    setActionLoading(loanId);
    try {
      const { error: loanErr } = await supabase
        .from('loans')
        .update({ 
          status: 'APPROVED', 
          approved_at: new Date().toISOString() 
        })
        .eq('id', loanId);
      
      if (loanErr) throw loanErr;

      let remainingToCover = amount;
      for (const s of selectedSavings) {
        if (remainingToCover <= 0) break;
        const available = calculateRealBalance(s);
        const amountFromThisSaving = Math.min(remainingToCover, available);
        
        await supabase.from('loan_savings_backing').insert({
          loan_id: loanId,
          saving_id: s.id,
          amount_used: amountFromThisSaving
        });
        remainingToCover -= amountFromThisSaving;
      }

      setSelectedSavingIds([]);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleProjectImageUpload = async (file: File, isNew: boolean) => {
    setActionLoading('uploading-project-image');
    try {
      const reader = new FileReader();
      const webpUrl = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const webpData = canvas.toDataURL('image/webp', 0.8);
            const byteChars = atob(webpData.split(',')[1]);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const fileName = `cover_${Date.now()}.webp`;
            const { error } = await supabase.storage.from('newBankPortadaProyecto').upload(fileName, new Blob([bytes], { type: 'image/webp' }));
            if (error) reject(error);
            else resolve(supabase.storage.from('newBankPortadaProyecto').getPublicUrl(fileName).data.publicUrl);
          };
        };
      });

      if (isNew) {
        setNewProject(prev => ({ ...prev, cover_image_url: webpUrl }));
      } else {
        setSelectedProject(prev => ({ ...prev, cover_image_url: webpUrl }));
      }
      alert("Imagen subida con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al subir la imagen del proyecto.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateProject = async () => {
    setActionLoading('creating-project');
    try {
      const { error } = await supabase.from('projects').insert({ ...newProject, creator_id: user.id });
      if (error) throw error;
      alert("Proyecto creado exitosamente.");
      setNewProject({
        name: '', cover_image_url: '', summary_vision: '', summary_problem: '', summary_solution: '', summary_business_model: '', summary_amount: 0, summary_use_of_funds: '', summary_roi: '',
        desc_mission: '', desc_vision: '', desc_values: '', desc_history: '', desc_stage: '', desc_legal_form: '', desc_location: '',
        market_size: '', market_target: '', market_trends: '', market_opportunity: '',
        comp_direct: '', comp_diff: '',
        prod_desc: '', prod_roadmap: '', prod_tech: '',
        team_profiles: '', team_advisors: '', team_org: '',
        model_revenue: '', model_equity: 0, model_pre_money: 0, model_post_money: 0, model_rights: '', model_exit: '',
        marketing_attraction: '', marketing_strategy: '', marketing_channels: '',
        ops_timeline: '', ops_resources: '', ops_risks: '',
        fin_use_funds: '', fin_projections: '', fin_break_even: '', fin_scenarios: '',
        legal_compliance: '', legal_assets: '', legal_fintech: '', legal_contracts: '', legal_kyc: '', legal_taxes: '',
        risks_reg: '', risks_market: '', risks_ops: '', risks_fin: '', risks_contingency: '',
        annexes: ''
      });
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error al crear el proyecto. Asegúrate de que la tabla 'projects' exista en Supabase.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;
    setActionLoading('updating-project');
    try {
      const { error } = await supabase
        .from('projects')
        .update(selectedProject)
        .eq('id', selectedProject.id);
      
      if (error) throw error;
      alert("Proyecto actualizado exitosamente.");
      setIsEditingProject(false);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el proyecto.");
    } finally {
      setActionLoading(null);
    }
  };

  // Funciones para Tienda/Productos
  const handleCreateProduct = async () => {
    setActionLoading('creating-product');
    try {
      const productToInsert = { 
        ...newProduct, 
        creator_id: newProduct.creator_id || user.id 
      };
      const { error } = await supabase.from('products').insert(productToInsert);
      if (error) throw error;
      alert("Producto creado exitosamente.");
      setNewProduct({
        name: '', description: '', stock: 0, price: 0, wompi_link: '', whatsapp_number: '50370914941', creator_id: '', is_visible: true, image_urls: ['', '', '', ''], category: 'Estilo de vida'
      });
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error al crear el producto.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProductImageUpload = async (file: File, isNew: boolean, index: number) => {
    setActionLoading(`uploading-product-image-${index}`);
    try {
      const fileName = `product_${Date.now()}_${index}.webp`;
      const reader = new FileReader();
      const webpUrl = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const webpData = canvas.toDataURL('image/webp', 0.8);
            const byteChars = atob(webpData.split(',')[1]);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const { error } = await supabase.storage.from('NewBankImageProductos').upload(fileName, new Blob([bytes], { type: 'image/webp' }));
            if (error) reject(error);
            else resolve(supabase.storage.from('NewBankImageProductos').getPublicUrl(fileName).data.publicUrl);
          };
        };
      });

      if (isNew) {
        const newUrls = [...newProduct.image_urls];
        newUrls[index] = webpUrl;
        setNewProduct(prev => ({ ...prev, image_urls: newUrls }));
      } else {
        const newUrls = [...editingProduct.image_urls];
        newUrls[index] = webpUrl;
        setEditingProduct(prev => ({ ...prev, image_urls: newUrls }));
      }
      alert("Imagen subida con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al subir la imagen del producto.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    setActionLoading('deleting-' + id);
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    setActionLoading('updating-product');
    try {
      const { error } = await supabase
        .from('products')
        .update(editingProduct)
        .eq('id', editingProduct.id);
      if (error) throw error;
      alert("Producto actualizado exitosamente.");
      setEditingProduct(null);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el producto.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleProductVisibility = async (product: any) => {
    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_visible: !product.is_visible })
        .eq('id', product.id);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignAliado = async (productId: string, aliadoId: string) => {
    setActionLoading(productId + '-assign');
    try {
      const { error } = await supabase
        .from('products')
        .update({ creator_id: aliadoId || null })
        .eq('id', productId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error("Error asignando aliado:", err);
      alert("Error al asignar aliado.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProductCategory = async (productId: string, category: string) => {
    setActionLoading(productId + '-category');
    try {
      const { error } = await supabase
        .from('products')
        .update({ category })
        .eq('id', productId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error("Error actualizando categoría:", err);
      alert("Error al actualizar la categoría.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotifyWishlist = async (productId: string) => {
    setActionLoading('notifying-' + productId);
    try {
      const product = products.find(p => p.id === productId);
      const interestedUsers = wishlistItems.filter(w => w.product_id === productId);
      
      if (interestedUsers.length === 0) {
        alert("No hay usuarios en la lista de deseos para este producto.");
        return;
      }

      // Enviar correos (simulado vía mailto para este entorno, o podrías usar una Edge Function si existiera)
      // Aquí simularemos la notificación actualizando un campo en la wishlist o enviando correos
      for (const item of interestedUsers) {
        const subject = encodeURIComponent(`¡Producto Disponible! - ${product.name}`);
        const body = encodeURIComponent(
          `Hola ${item.user?.full_name},\n\n` +
          `Te informamos que el producto "${product.name}" que tenías en tu lista de deseos ya está disponible en nuestra tienda.\n\n` +
          `Puedes adquirirlo aquí: ${product.wompi_link}\n\n` +
          `¡Gracias por confiar en NewBank AI!`
        );
        // En un entorno real esto sería un servicio de email. Aquí abrimos el cliente de correo para el admin.
        window.open(`mailto:${item.user?.email}?subject=${subject}&body=${body}`, '_blank');
      }
      
      alert(`Se han preparado notificaciones para ${interestedUsers.length} usuarios.`);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsPurchasedFromSupplier = async (wishlistItemId: string) => {
    setActionLoading('purchasing-' + wishlistItemId);
    try {
      const { error } = await supabase
        .from('product_wishlist')
        .update({ status: 'PURCHASED_FROM_SUPPLIER' })
        .eq('id', wishlistItemId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsDelivered = async (orderId: string) => {
    setActionLoading('delivering-' + orderId);
    try {
      const { error } = await supabase
        .from('product_orders')
        .update({ status: 'DELIVERED' })
        .eq('id', orderId);
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const filteredAllLoans = allLoans.filter(l => 
    l.user?.dui?.toLowerCase().includes(searchDui.toLowerCase())
  );

  const filteredControlTotal = allLoans.filter(l => 
    l.user?.dui?.toLowerCase().includes(searchDui.toLowerCase())
  );

  const toggleAccordion = (section: string) => {
    setOpenAccordion(openAccordion === section ? null : section);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <AdminAvatarPanel user={user} />
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">Consola de Control</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Administración de Préstamos y Ahorros.</p>
          
          {!showWompi && (
            <div className="flex items-center gap-3 border-b pb-4 border-slate-200 w-fit mt-4">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Gestión de Tienda:</span>
                <button 
                   onClick={() => {
                     const newValue = !showWompi;
                     setShowWompi(newValue);
                     localStorage.setItem('newbank_show_wompi', String(newValue));
                     window.dispatchEvent(new Event('storage'));
                   }}
                   className={`px-3 py-1.5 rounded-xl border-2 transition-all flex items-center gap-2 group ${
                     showWompi 
                       ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                       : 'bg-slate-50 border-slate-200 text-slate-400 opacity-80'
                   }`}
                >
                  <div className={`w-2 h-2 rounded-full transition-all ${showWompi ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`}></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {showWompi ? 'Botones de Pago: VISIBLES' : 'Botones de Pago: OCULTOS'}
                  </span>
                  <span className="text-xs">{showWompi ? '👁️' : '🚫'}</span>
                </button>
            </div>
          )}
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto w-full lg:w-auto">
          {[
            { id: 'dashboard', label: 'Dashboard & Métricas', icon: '📊', roles: ['admin'] },
            { id: 'realtime_metrics', label: 'Métricas en Vivo', icon: '⚡', roles: ['admin'] },
            { id: 'web_analytics', label: 'Analítica Web', icon: '🌐', roles: ['admin'] },
            { id: 'approvals', label: 'Nuevos', icon: '✨', roles: ['admin'] },
            { id: 'saving_vouchers', label: 'Vouchers Ahorro', icon: '💰', roles: ['admin'] },
            { id: 'active_savings', label: 'Ahorros Vigentes', icon: '📈', roles: ['admin'] },
            { id: 'return_vouchers', label: 'Vouchers Devolución', icon: '📤', roles: ['admin'] },
            { id: 'active_loans', label: 'Activos', icon: '💸', roles: ['admin'] },
            { id: 'validacion_pagos', label: 'Validación de Pagos', icon: '✅', roles: ['admin'] },
            { id: 'payment_requests', label: 'Solicitudes de Cambio', icon: '💎', roles: ['admin'] },
            { id: 'control_total', label: 'Control Total', icon: '🛡️', roles: ['admin'] },
            { id: 'control_global_pagos', label: 'Control Global', icon: '🌍', roles: ['admin'] },
            { id: 'projects', label: 'Proyectos', icon: '🚀', roles: ['admin'] },
            { id: 'store_admin', label: 'Tienda', icon: '🛒', roles: ['admin', 'aliado'] },
            { id: 'orders_admin', label: 'Pedidos', icon: '📦', roles: ['admin', 'aliado'] },
            { id: 'users', label: 'Usuarios', icon: '👥', roles: ['admin'] },
            { id: 'avatares', label: 'Avatares', icon: '🤖', roles: ['admin'] }
          ].filter(tab => tab.roles.includes(user?.profile_type) || user?.is_admin).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'payment_requests' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden animate-fade-in">
          <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black uppercase text-slate-900">Solicitudes de Cambio de Diamantes</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestión de retiros de usuarios.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-widest">
                  <th className="px-6 py-4">Usuario / DUI</th>
                  <th className="px-6 py-4">Diamantes / Total</th>
                  <th className="px-6 py-4">Banco / Cuenta</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-xs">No hay solicitudes registradas</td>
                  </tr>
                ) : (
                  paymentRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900 text-xs uppercase">{req.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">DUI: {req.dui}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-blue-600 text-xs">💎 {req.diamonds_amount}</div>
                        <div className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Recibir: ${req.total_amount.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700 text-xs">{req.bank_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{req.account_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-bold text-slate-600">{req.phone}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{req.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          req.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {req.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {req.status === 'PENDING' && (
                          <button 
                            onClick={() => handleMarkPaymentAsPaid(req.id)}
                            disabled={actionLoading === req.id}
                            className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-700 transition shadow-lg shadow-green-100 disabled:opacity-50"
                          >
                            {actionLoading === req.id ? '...' : 'Marcar Pagado'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === 'dashboard' || activeTab === 'realtime_metrics') && (
        <SystemRealtimeMetrics 
          user={user} 
          onNavigateTab={(tabId) => setActiveTab(tabId as any)} 
        />
      )}

      {activeTab === 'web_analytics' && (
        <WebAnalyticsRealtime user={user} />
      )}

      {activeTab === 'projects' && (
        <div className="space-y-8 animate-fade-in">
          {selectedProject ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border animate-fade-in">
              <div className="flex justify-between items-center mb-8 border-b pb-6">
                <div>
                  <h3 className="text-2xl font-black uppercase text-slate-900">
                    {isEditingProject ? 'Editando: ' : ''}{selectedProject.name}
                  </h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
                    ID: {selectedProject.id} | Creado: {new Date(selectedProject.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-3">
                  {!isEditingProject ? (
                    <button 
                      onClick={() => setIsEditingProject(true)}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                    >
                      Habilitar Edición
                    </button>
                  ) : (
                    <button 
                      onClick={handleUpdateProject}
                      disabled={actionLoading === 'updating-project'}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition"
                    >
                      {actionLoading === 'updating-project' ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedProject(null); setIsEditingProject(false); }}
                    className="px-6 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition"
                  >
                    Volver a la Lista
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Columna Izquierda - Resumen y Descripción */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Foto de Portada */}
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-xs uppercase tracking-widest mb-4 text-blue-600">Portada del Proyecto</h4>
                    <div className="flex flex-col gap-4">
                      {selectedProject.cover_image_url ? (
                        <img src={selectedProject.cover_image_url || undefined} className="w-full h-48 object-cover rounded-2xl shadow-md border" alt="Portada" />
                      ) : (
                        <div className="w-full h-48 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold uppercase text-xs">Sin Portada</div>
                      )}
                      {isEditingProject && (
                        <div className="flex items-center gap-3">
                           <input 
                              type="file" 
                              className="text-[10px] font-bold" 
                              accept="image/*"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleProjectImageUpload(file, false);
                              }}
                           />
                           {actionLoading === 'uploading-project-image' && <span className="animate-pulse text-[9px] font-black text-blue-600">Subiendo...</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumen Ejecutivo */}
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-blue-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Resumen Ejecutivo
                    </h4>
                    <div className="grid grid-cols-1 gap-6">
                      {[
                        { label: 'Visión General', field: 'summary_vision' },
                        { label: 'Problema', field: 'summary_problem' },
                        { label: 'Solución', field: 'summary_solution' },
                        { label: 'Modelo de Negocio', field: 'summary_business_model' },
                        { label: 'Uso de Fondos', field: 'summary_use_of_funds' },
                        { label: 'ROI Esperado', field: 'summary_roi' }
                      ].map(item => (
                        <div key={item.field}>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">{item.label}</label>
                          {isEditingProject ? (
                            <textarea 
                              className="w-full p-3 rounded-xl border text-xs font-bold bg-white" 
                              rows={2} 
                              value={selectedProject[item.field] || ''} 
                              onChange={e => setSelectedProject({...selectedProject, [item.field]: e.target.value})}
                            />
                          ) : (
                            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100">
                              {selectedProject[item.field] || 'Sin información registrada.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Descripción del Proyecto */}
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-indigo-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> Identidad y Origen
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { label: 'Misión', field: 'desc_mission' },
                        { label: 'Visión', field: 'desc_vision' },
                        { label: 'Valores', field: 'desc_values' },
                        { label: 'Historia Breve', field: 'desc_history' }
                      ].map(item => (
                        <div key={item.field} className="col-span-full">
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">{item.label}</label>
                          {isEditingProject ? (
                            <textarea 
                              className="w-full p-3 rounded-xl border text-xs font-bold bg-white" 
                              rows={2} 
                              value={selectedProject[item.field] || ''} 
                              onChange={e => setSelectedProject({...selectedProject, [item.field]: e.target.value})}
                            />
                          ) : (
                            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100">
                              {selectedProject[item.field] || 'Sin información registrada.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha - Datos Críticos, Mercado y Legal */}
                <div className="space-y-8">
                  {/* Datos Financieros Críticos */}
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl">
                    <h4 className="font-black text-[10px] uppercase tracking-widest mb-6 opacity-60">Variables Financieras</h4>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Monto a Recaudar</label>
                        {isEditingProject ? (
                          <input 
                            type="number" 
                            className="bg-white/10 w-full p-3 rounded-xl border border-white/20 text-white font-black text-xl outline-none"
                            value={Number.isNaN(selectedProject.summary_amount as any) ? '' : selectedProject.summary_amount} 
                            onChange={e => setSelectedProject({...selectedProject, summary_amount: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                          />
                        ) : (
                          <div className="text-3xl font-black text-blue-400">${selectedProject.summary_amount?.toLocaleString()}</div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">% Acciones</label>
                          {isEditingProject ? (
                            <input 
                              type="number" 
                              className="bg-white/10 w-full p-2 rounded-lg border border-white/20 text-white font-bold text-xs"
                              value={Number.isNaN(selectedProject.model_equity as any) ? '' : selectedProject.model_equity} 
                              onChange={e => setSelectedProject({...selectedProject, model_equity: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                            />
                          ) : (
                            <div className="text-lg font-black">{selectedProject.model_equity}%</div>
                          )}
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Etapa Actual</label>
                          {isEditingProject ? (
                            <input 
                              type="text" 
                              className="bg-white/10 w-full p-2 rounded-lg border border-white/20 text-white font-bold text-xs"
                              value={selectedProject.desc_stage} 
                              onChange={e => setSelectedProject({...selectedProject, desc_stage: e.target.value})}
                            />
                          ) : (
                            <div className="text-lg font-black uppercase">{selectedProject.desc_stage || 'Idea'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mercado */}
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-green-600">Oportunidad de Mercado</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Tamaño Mercado', field: 'market_size' },
                        { label: 'Público Objetivo', field: 'market_target' },
                        { label: 'Oportunidad', field: 'market_opportunity' }
                      ].map(item => (
                        <div key={item.field}>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{item.label}</label>
                          {isEditingProject ? (
                            <input 
                              className="w-full p-2.5 rounded-xl border text-xs font-bold bg-white" 
                              value={selectedProject[item.field] || ''} 
                              onChange={e => setSelectedProject({...selectedProject, [item.field]: e.target.value})}
                            />
                          ) : (
                            <div className="text-xs font-bold text-slate-800">{selectedProject[item.field] || 'N/A'}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal y Regulatorio */}
                  <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                    <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-blue-700">Cumplimiento Legal SV</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Forma Jurídica', field: 'desc_legal_form' },
                        { label: 'Ubicación', field: 'desc_location' },
                        { label: 'Cumplimiento SSF', field: 'legal_compliance' },
                        { label: 'Activos Digitales', field: 'legal_assets' }
                      ].map(item => (
                        <div key={item.field}>
                          <label className="text-[9px] font-black text-blue-400 uppercase mb-1 block">{item.label}</label>
                          {isEditingProject ? (
                            <input 
                              className="w-full p-2.5 rounded-xl border border-blue-200 text-xs font-bold bg-white" 
                              value={selectedProject[item.field] || ''} 
                              onChange={e => setSelectedProject({...selectedProject, [item.field]: e.target.value})}
                            />
                          ) : (
                            <div className="text-xs font-bold text-blue-900">{selectedProject[item.field] || 'Pendiente'}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Secciones Inferiores Adicionales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 border-t pt-8">
                <div className="space-y-6">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Modelo de Negocio & Equity</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Valoración Pre-Money', field: 'model_pre_money' },
                      { label: 'Valoración Post-Money', field: 'model_post_money' }
                    ].map(item => (
                      <div key={item.field}>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{item.label}</label>
                        {isEditingProject ? (
                          <input 
                            type="number"
                            className="w-full p-2.5 rounded-xl border text-xs font-bold bg-white" 
                            value={selectedProject[item.field] || 0} 
                            onChange={e => setSelectedProject({...selectedProject, [item.field]: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                          />
                        ) : (
                          <div className="text-xs font-bold text-slate-800">${selectedProject[item.field]?.toLocaleString() || '0'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Anexos y Recursos</h4>
                  {isEditingProject ? (
                    <textarea 
                      className="w-full p-3 rounded-xl border text-xs font-bold bg-white" 
                      rows={3} 
                      placeholder="URLs de Anexos separadas por comas..."
                      value={selectedProject.annexes || ''} 
                      onChange={e => setSelectedProject({...selectedProject, annexes: e.target.value})}
                    />
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <p className="text-xs text-blue-600 font-bold break-all italic">{selectedProject.annexes || 'No se han adjuntado recursos externos.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
                <h3 className="text-xl font-black uppercase mb-8 border-b pb-4">Crear Nuevo Proyecto de Inversión</h3>
                
                <div className="space-y-4">
                  {/* Acordeón 1: Resumen Ejecutivo */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('resumen')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'resumen' ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-blue-600">1. Resumen Ejecutivo y Portada</span>
                      <span className={`transform transition-transform ${openAccordion === 'resumen' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'resumen' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 animate-fade-in">
                        <div className="md:col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                           <label className="block text-[10px] font-black text-blue-600 uppercase mb-2">Imagen de Portada (WebP Auto-Convert)</label>
                           <div className="flex items-center gap-4">
                              <input 
                                type="file" 
                                className="text-[10px] font-bold" 
                                accept="image/*"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProjectImageUpload(file, true);
                                }}
                              />
                              {newProject.cover_image_url && (
                                <img src={newProject.cover_image_url || undefined} className="w-12 h-12 rounded object-cover border border-blue-200" alt="Previa" />
                              )}
                              {actionLoading === 'uploading-project-image' && <span className="animate-pulse text-[9px] font-black text-blue-600 uppercase">Procesando...</span>}
                           </div>
                        </div>
                        <input type="text" placeholder="Nombre del Proyecto" className="p-3 rounded-xl border font-bold text-xs" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                        <textarea placeholder="Visión General" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_vision} onChange={e => setNewProject({...newProject, summary_vision: e.target.value})} />
                        <textarea placeholder="Qué problema resuelve" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_problem} onChange={e => setNewProject({...newProject, summary_problem: e.target.value})} />
                        <textarea placeholder="Solución propuesta" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_solution} onChange={e => setNewProject({...newProject, summary_solution: e.target.value})} />
                        <textarea placeholder="Modelo de negocio" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_business_model} onChange={e => setNewProject({...newProject, summary_business_model: e.target.value})} />
                        <input type="number" placeholder="Monto a recaudar" className="p-3 rounded-xl border font-bold text-xs" value={Number.isNaN(newProject.summary_amount as any) ? '' : newProject.summary_amount} onChange={e => setNewProject({...newProject, summary_amount: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                        <textarea placeholder="Uso de fondos" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_use_of_funds} onChange={e => setNewProject({...newProject, summary_use_of_funds: e.target.value})} />
                        <textarea placeholder="Proyecciones clave (ROI)" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_roi} onChange={e => setNewProject({...newProject, summary_roi: e.target.value})} />
                      </div>
                    )}
                  </div>

                  {/* Acordeón 2: Descripción del Proyecto */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('identidad')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'identidad' ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-indigo-600">2. Identidad y Origen</span>
                      <span className={`transform transition-transform ${openAccordion === 'identidad' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'identidad' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 animate-fade-in">
                        <textarea placeholder="Misión" className="p-3 rounded-xl border text-xs" value={newProject.desc_mission} onChange={e => setNewProject({...newProject, desc_mission: e.target.value})} />
                        <textarea placeholder="Visión" className="p-3 rounded-xl border text-xs" value={newProject.desc_vision} onChange={e => setNewProject({...newProject, desc_vision: e.target.value})} />
                        <textarea placeholder="Valores" className="p-3 rounded-xl border text-xs" value={newProject.desc_values} onChange={e => setNewProject({...newProject, desc_values: e.target.value})} />
                        <textarea placeholder="Historia breve" className="p-3 rounded-xl border text-xs" value={newProject.desc_history} onChange={e => setNewProject({...newProject, desc_history: e.target.value})} />
                        <input type="text" placeholder="Etapa actual (MVP, Beta...)" className="p-3 rounded-xl border text-xs" value={newProject.desc_stage} onChange={e => setNewProject({...newProject, desc_stage: e.target.value})} />
                        <input type="text" placeholder="Forma jurídica" className="p-3 rounded-xl border text-xs" value={newProject.desc_legal_form} onChange={e => setNewProject({...newProject, desc_legal_form: e.target.value})} />
                        <input type="text" placeholder="Ubicación" className="p-3 rounded-xl border text-xs" value={newProject.desc_location} onChange={e => setNewProject({...newProject, desc_location: e.target.value})} />
                      </div>
                    )}
                  </div>

                  {/* Acordeón 3: Mercado y Competencia */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('mercado')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'mercado' ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-green-600">3. Mercado y Competencia</span>
                      <span className={`transform transition-transform ${openAccordion === 'mercado' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'mercado' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                        <div className="space-y-3">
                          <input type="text" placeholder="Tamaño mercado objetivo" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_size} onChange={e => setNewProject({...newProject, market_size: e.target.value})} />
                          <input type="text" placeholder="Público objetivo" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_target} onChange={e => setNewProject({...newProject, market_target: e.target.value})} />
                          <textarea placeholder="Tendencias y Oportunidad" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_trends} onChange={e => setNewProject({...newProject, market_trends: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <textarea placeholder="Competidores directos" className="w-full p-3 rounded-xl border text-xs" value={newProject.comp_direct} onChange={e => setNewProject({...newProject, comp_direct: e.target.value})} />
                          <textarea placeholder="Diferenciadores" className="w-full p-3 rounded-xl border text-xs" value={newProject.comp_diff} onChange={e => setNewProject({...newProject, comp_diff: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acordeón 4: Producto y Equipo */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('producto')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'producto' ? 'bg-orange-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-orange-600">4. Producto y Equipo</span>
                      <span className={`transform transition-transform ${openAccordion === 'producto' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'producto' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                        <div className="space-y-3">
                          <textarea placeholder="Detalle desarrollo acciones" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_desc} onChange={e => setNewProject({...newProject, prod_desc: e.target.value})} />
                          <textarea placeholder="Roadmap (Fases)" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_roadmap} onChange={e => setNewProject({...newProject, prod_roadmap: e.target.value})} />
                          <input type="text" placeholder="Tecnología" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_tech} onChange={e => setNewProject({...newProject, prod_tech: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <textarea placeholder="Perfiles equipo" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_profiles} onChange={e => setNewProject({...newProject, team_profiles: e.target.value})} />
                          <textarea placeholder="Advisors o socios" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_advisors} onChange={e => setNewProject({...newProject, team_advisors: e.target.value})} />
                          <input type="text" placeholder="Estructura organizacional" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_org} onChange={e => setNewProject({...newProject, team_org: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acordeón 5: Modelo de Negocio y Equity */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('negocio')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'negocio' ? 'bg-slate-900' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className={`font-black uppercase text-xs tracking-widest ${openAccordion === 'negocio' ? 'text-white' : 'text-slate-900'}`}>5. Modelo de Negocio y Equity</span>
                      <span className={`transform transition-transform ${openAccordion === 'negocio' ? 'rotate-180 text-white' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'negocio' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-slate-50 animate-fade-in">
                        <textarea placeholder="Cómo genera ingresos" className="p-3 rounded-xl border text-xs" value={newProject.model_revenue} onChange={e => setNewProject({...newProject, model_revenue: e.target.value})} />
                        <input type="number" placeholder="% Acciones ofrecidas" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_equity as any) ? '' : newProject.model_equity} onChange={e => setNewProject({...newProject, model_equity: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                        <input type="number" placeholder="Valoración pre-money" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_pre_money as any) ? '' : newProject.model_pre_money} onChange={e => setNewProject({...newProject, model_pre_money: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                        <input type="number" placeholder="Valoración post-money" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_post_money as any) ? '' : newProject.model_post_money} onChange={e => setNewProject({...newProject, model_post_money: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                        <textarea placeholder="Derechos (Voto, dividendos, salida)" className="p-3 rounded-xl border text-xs" value={newProject.model_rights} onChange={e => setNewProject({...newProject, model_rights: e.target.value})} />
                        <textarea placeholder="Estrategia de salida (Exit strategy)" className="p-3 rounded-xl border text-xs" value={newProject.model_exit} onChange={e => setNewProject({...newProject, model_exit: e.target.value})} />
                      </div>
                    )}
                  </div>

                  {/* Acordeón 6: Marketing y Plan Operativo */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('marketing')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'marketing' ? 'bg-pink-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-pink-600">6. Marketing y Plan Operativo</span>
                      <span className={`transform transition-transform ${openAccordion === 'marketing' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'marketing' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                        <div className="space-y-3">
                          <textarea placeholder="Cómo atraer inversionistas" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_attraction} onChange={e => setNewProject({...newProject, marketing_attraction: e.target.value})} />
                          <textarea placeholder="Estrategia venta acciones" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_strategy} onChange={e => setNewProject({...newProject, marketing_strategy: e.target.value})} />
                          <input type="text" placeholder="Canales" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_channels} onChange={e => setNewProject({...newProject, marketing_channels: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <textarea placeholder="Cronograma detallado (Hitos)" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_timeline} onChange={e => setNewProject({...newProject, ops_timeline: e.target.value})} />
                          <textarea placeholder="Recursos necesarios" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_resources} onChange={e => setNewProject({...newProject, ops_resources: e.target.value})} />
                          <textarea placeholder="Riesgos mitigación" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_risks} onChange={e => setNewProject({...newProject, ops_risks: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acordeón 7: Finanzas, Legal y Riesgos */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('legal')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'legal' ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-blue-700">7. Finanzas, Legal y Riesgos</span>
                      <span className={`transform transition-transform ${openAccordion === 'legal' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'legal' && (
                      <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-50 animate-fade-in">
                        <div className="space-y-3">
                          <textarea placeholder="Desglose uso fondos" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_use_funds} onChange={e => setNewProject({...newProject, fin_use_funds: e.target.value})} />
                          <textarea placeholder="Proyecciones 3-5 años" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_projections} onChange={e => setNewProject({...newProject, fin_projections: e.target.value})} />
                          <input type="text" placeholder="Break-even point" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_break_even} onChange={e => setNewProject({...newProject, fin_break_even: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <textarea placeholder="Cumplimiento SSF/BCR" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_compliance} onChange={e => setNewProject({...newProject, legal_compliance: e.target.value})} />
                          <textarea placeholder="Activos digitales / Tokens" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_assets} onChange={e => setNewProject({...newProject, legal_assets: e.target.value})} />
                          <textarea placeholder="KYC / AML" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_kyc} onChange={e => setNewProject({...newProject, legal_kyc: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <textarea placeholder="Regulatorios / Mercados" className="w-full p-3 rounded-xl border text-xs" value={newProject.risks_reg} onChange={e => setNewProject({...newProject, risks_reg: e.target.value})} />
                          <textarea placeholder="Plan contingencia" className="w-full p-3 rounded-xl border text-xs" value={newProject.risks_contingency} onChange={e => setNewProject({...newProject, risks_contingency: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acordeón 8: Anexos */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleAccordion('anexos')}
                      className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'anexos' ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-black uppercase text-xs tracking-widest text-slate-500">8. Anexos y Otros</span>
                      <span className={`transform transition-transform ${openAccordion === 'anexos' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'anexos' && (
                      <div className="p-6 bg-white border-t border-slate-50 animate-fade-in">
                        <textarea placeholder="URLs de Anexos (CVs, Prototipos, Screenshots...)" className="w-full p-3 rounded-xl border text-xs" rows={2} value={newProject.annexes} onChange={e => setNewProject({...newProject, annexes: e.target.value})} />
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleCreateProject}
                  disabled={actionLoading === 'creating-project' || !newProject.name}
                  className="mt-10 w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-black transition disabled:opacity-30"
                >
                  {actionLoading === 'creating-project' ? 'Creando Proyecto...' : 'Publicar Proyecto para Venta de Acciones'}
                </button>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden mt-8">
                <h3 className="p-8 font-black uppercase tracking-widest text-sm border-b">Proyectos Publicados</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                      <tr>
                        <th className="px-8 py-4">Proyecto</th>
                        <th className="px-8 py-4">Monto Recaudar</th>
                        <th className="px-8 py-4">Etapa</th>
                        <th className="px-8 py-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {projects.map(p => (
                        <tr key={p.id} className="text-sm hover:bg-slate-50">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                               {p.cover_image_url && <img src={p.cover_image_url} className="w-8 h-8 rounded object-cover shadow-sm" alt="T" />}
                               <div>
                                  <div className="font-black text-slate-900">{p.name}</div>
                                  <div className="text-[10px] text-slate-400">{p.desc_legal_form}</div>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-4 font-black">${p.summary_amount?.toFixed(2)}</td>
                          <td className="px-8 py-4 uppercase text-[10px] font-black">{p.desc_stage}</td>
                          <td className="px-8 py-4">
                            <button 
                              onClick={() => setSelectedProject(p)}
                              className="text-blue-600 font-black uppercase text-[10px] hover:underline"
                            >
                              Ver Detalles
                            </button>
                          </td>
                        </tr>
                      ))}
                      {projects.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No se han creado proyectos aún.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'store_admin' && (
        <div className="space-y-8 animate-fade-in">
          {/* Botón de Gestión de Tienda (Visible solo cuando está activado) */}
          {showWompi && (
            <div className="flex items-center gap-3 border-b pb-4 border-slate-200 w-fit">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Gestión de Tienda:</span>
                <button 
                   onClick={() => {
                     const newValue = !showWompi;
                     setShowWompi(newValue);
                     localStorage.setItem('newbank_show_wompi', String(newValue));
                     window.dispatchEvent(new Event('storage'));
                   }}
                   className="px-3 py-1.5 rounded-xl border-2 transition-all flex items-center gap-2 group bg-blue-50 border-blue-200 text-blue-600 shadow-sm"
                >
                  <div className="w-2 h-2 rounded-full transition-all bg-blue-600 animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Botones de Pago: VISIBLES
                  </span>
                  <span className="text-xs">👁️</span>
                </button>
            </div>
          )}

          {/* Formulario de Creación/Edición */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
            <h3 className="text-xl font-black uppercase mb-8 border-b pb-4">
              {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Imágenes del Carrusel (4 URLs o Cargar)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <input 
                          type="text" 
                          placeholder={`URL Imagen ${i + 1}`}
                          className="p-2 rounded-lg border text-[10px] font-bold"
                          value={editingProduct ? editingProduct.image_urls[i] : newProduct.image_urls[i]}
                          onChange={e => {
                            const val = e.target.value;
                            if (editingProduct) {
                              const newUrls = [...editingProduct.image_urls];
                              newUrls[i] = val;
                              setEditingProduct({...editingProduct, image_urls: newUrls});
                            } else {
                              const newUrls = [...newProduct.image_urls];
                              newUrls[i] = val;
                              setNewProduct({...newProduct, image_urls: newUrls});
                            }
                          }}
                        />
                        <div className="flex items-center justify-between">
                          <input 
                            type="file" 
                            accept="image/*"
                            capture="environment"
                            className="text-[8px] font-bold w-full"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleProductImageUpload(file, !!editingProduct === false, i);
                            }}
                          />
                          {(editingProduct ? editingProduct.image_urls[i] : newProduct.image_urls[i]) && (
                            <img 
                              src={editingProduct ? editingProduct.image_urls[i] : newProduct.image_urls[i]} 
                              className="w-6 h-6 rounded object-cover shadow-sm border border-white" 
                              alt="Previa" 
                            />
                          )}
                        </div>
                        {actionLoading === `uploading-product-image-${i}` && (
                          <span className="text-[8px] text-blue-600 font-bold animate-pulse">Subiendo...</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <input 
                  type="text" 
                  placeholder="Nombre del Producto" 
                  className="w-full p-3 rounded-xl border font-bold text-xs"
                  value={editingProduct ? editingProduct.name : newProduct.name}
                  onChange={e => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})}
                />
                
                <textarea 
                  placeholder="Descripción del Producto" 
                  className="w-full p-3 rounded-xl border text-xs h-24"
                  value={editingProduct ? editingProduct.description : newProduct.description}
                  onChange={e => editingProduct ? setEditingProduct({...editingProduct, description: e.target.value}) : setNewProduct({...newProduct, description: e.target.value})}
                />
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Unidades Disponibles</label>
                    <input 
                      type="number" 
                      className="w-full p-3 rounded-xl border font-bold text-xs"
                      value={editingProduct ? editingProduct.stock : newProduct.stock}
                      onChange={e => editingProduct ? setEditingProduct({...editingProduct, stock: (e.target.value === '' ? '' as any : parseInt(e.target.value))}) : setNewProduct({...newProduct, stock: (e.target.value === '' ? '' as any : parseInt(e.target.value))})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Precio (Normal/Promoción)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 rounded-xl border font-bold text-xs"
                      value={editingProduct ? editingProduct.price : newProduct.price}
                      onChange={e => editingProduct ? setEditingProduct({...editingProduct, price: (e.target.value === '' ? '' as any : parseFloat(e.target.value))}) : setNewProduct({...newProduct, price: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Link de Pago Wompi</label>
                  <input 
                    type="text" 
                    placeholder="https://wompi.com/..."
                    className="w-full p-3 rounded-xl border font-bold text-xs"
                    value={editingProduct ? editingProduct.wompi_link : newProduct.wompi_link}
                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, wompi_link: e.target.value}) : setNewProduct({...newProduct, wompi_link: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">WhatsApp de Consulta</label>
                  <input 
                    type="text" 
                    placeholder="50370914941"
                    className="w-full p-3 rounded-xl border font-bold text-xs"
                    value={editingProduct ? (editingProduct.whatsapp_number || '50370914941') : newProduct.whatsapp_number}
                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, whatsapp_number: e.target.value}) : setNewProduct({...newProduct, whatsapp_number: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Asignar Aliado o Admin (Opcional)</label>
                  <select 
                    className="w-full p-3 rounded-xl border font-bold text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    value={editingProduct ? editingProduct.creator_id || '' : newProduct.creator_id || ''}
                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, creator_id: e.target.value}) : setNewProduct({...newProduct, creator_id: e.target.value})}
                    disabled={user?.profile_type === 'aliado'}
                  >
                    <option value="">Sin Asignar</option>
                    {users.filter(u => u.profile_type === 'aliado' || u.is_admin).map(aliado => (
                      <option key={aliado.id} value={aliado.id}>{aliado.full_name} {aliado.is_admin ? '(Admin)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoría del Producto</label>
                  <select 
                    className="w-full p-3 rounded-xl border font-bold text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingProduct ? editingProduct.category || 'Estilo de vida' : newProduct.category || 'Estilo de vida'}
                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, category: e.target.value}) : setNewProduct({...newProduct, category: e.target.value})}
                  >
                    <option value="Estilo de vida">Estilo de vida</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Juguetes">Juguetes</option>
                    <option value="Accesorios">Accesorios</option>
                  </select>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button 
                    onClick={() => editingProduct ? setEditingProduct({...editingProduct, is_visible: !editingProduct.is_visible}) : setNewProduct({...newProduct, is_visible: !newProduct.is_visible})}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition ${
                      (editingProduct ? editingProduct.is_visible : newProduct.is_visible) 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {(editingProduct ? editingProduct.is_visible : newProduct.is_visible) ? 'Visible en Tienda' : 'Oculto en Tienda'}
                  </button>
                  
                  {editingProduct && (
                    <button 
                      onClick={() => setEditingProduct(null)}
                      className="px-6 py-3 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}
              disabled={actionLoading === 'creating-product' || actionLoading === 'updating-product'}
              className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition disabled:opacity-30"
            >
              {actionLoading === 'creating-product' || actionLoading === 'updating-product' 
                ? 'Procesando...' 
                : (editingProduct ? 'Actualizar Información del Producto' : 'Crear Producto')}
            </button>
          </div>

          {/* Listado de Productos */}
          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
            <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-black uppercase tracking-widest text-sm">Inventario de Productos</h3>
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Buscar productos..."
                    className="w-full md:w-64 pl-9 pr-4 py-2 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Todo', 'Estilo de vida', 'Hogar', 'Juguetes', 'Accesorios'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${
                        categoryFilter === cat 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Producto</th>
                    <th className="px-8 py-4">Categoría</th>
                    <th className="px-8 py-4">Stock</th>
                    <th className="px-8 py-4">Precio</th>
                    <th className="px-8 py-4">Estado</th>
                    <th className="px-8 py-4">Aliado</th>
                    <th className="px-8 py-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products
                    .filter(p => {
                      const matchesSearch = p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.description?.toLowerCase().includes(productSearch.toLowerCase());
                      const matchesCategory = categoryFilter === 'Todo' || p.category === categoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .map(p => (
                    <tr key={p.id} className="text-sm hover:bg-slate-50">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <img src={p.image_urls?.[0]} className="w-10 h-10 rounded-lg object-cover border" alt="P" />
                          <div>
                            <div className="font-black text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">{p.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <select 
                          value={p.category || 'Estilo de vida'}
                          onChange={(e) => handleUpdateProductCategory(p.id, e.target.value)}
                          className="text-[9px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Estilo de vida">Estilo de vida</option>
                          <option value="Hogar">Hogar</option>
                          <option value="Juguetes">Juguetes</option>
                          <option value="Accesorios">Accesorios</option>
                        </select>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`font-black ${p.stock <= 5 ? 'text-red-600' : 'text-slate-900'}`}>{p.stock} uds</span>
                      </td>
                      <td className="px-8 py-4 font-black text-blue-600">${p.price?.toFixed(2)}</td>
                      <td className="px-8 py-4">
                        <button 
                          onClick={() => handleToggleProductVisibility(p)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            p.is_visible ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {p.is_visible ? 'Visible' : 'Oculto'}
                        </button>
                      </td>
                      <td className="px-8 py-4">
                        <select 
                          value={p.creator_id || ''}
                          onChange={(e) => handleAssignAliado(p.id, e.target.value)}
                          className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px] disabled:opacity-50"
                          disabled={user?.profile_type === 'aliado'}
                        >
                          <option value="">Sin Asignar</option>
                          {users.filter(u => u.profile_type === 'aliado' || u.is_admin).map(aliado => (
                            <option key={aliado.id} value={aliado.id}>{aliado.full_name} {aliado.is_admin ? '(Admin)' : ''}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingProduct(p);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-blue-600 font-black uppercase text-[10px] hover:underline"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            disabled={actionLoading === 'deleting-' + p.id}
                            className="text-red-600 font-black uppercase text-[10px] hover:underline"
                          >
                            {actionLoading === 'deleting-' + p.id ? '...' : 'Eliminar'}
                          </button>
                          <button 
                            onClick={() => handleNotifyWishlist(p.id)}
                            className="text-orange-600 font-black uppercase text-[10px] hover:underline"
                            title="Notificar a interesados que ya hay stock"
                          >
                            Notificar Interesados
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gestión de Pedidos y Proveedores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pendientes de Comprar al Proveedor */}
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border">
              <div className="p-8 border-b bg-orange-50/50">
                <h3 className="font-black uppercase text-sm text-orange-800">Pendientes de Comprar al Proveedor</h3>
                <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Productos en lista de deseos (Sin Stock)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] text-slate-400 uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-3">Producto</th>
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3">Nota</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {wishlistItems.filter(w => w.status !== 'PURCHASED_FROM_SUPPLIER').map(item => (
                      <tr key={item.id} className="text-xs hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold">{item.product?.name}</td>
                        <td className="px-6 py-4">
                          <div className="font-black">{item.user?.full_name}</div>
                          <div className="text-[9px] text-slate-400">{item.user?.dui}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[9px] text-slate-500 italic max-w-[150px] truncate" title={item.notes}>
                            {item.notes || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Pendiente Compra</span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleMarkAsPurchasedFromSupplier(item.id)}
                            className="text-blue-600 font-black uppercase text-[9px] hover:underline"
                          >
                            Marcar Comprado
                          </button>
                        </td>
                      </tr>
                    ))}
                    {wishlistItems.filter(w => w.status !== 'PURCHASED_FROM_SUPPLIER').length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold uppercase text-[9px]">No hay compras pendientes al proveedor</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Productos para Entregar */}
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border">
              <div className="p-8 border-b bg-green-50/50">
                <h3 className="font-black uppercase text-sm text-green-800">Productos para Entregar</h3>
                <p className="text-[10px] font-bold text-green-600 uppercase mt-1">Pedidos pagados listos para envío</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] text-slate-400 uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-3">Cliente / Entrega</th>
                      <th className="px-6 py-3">Producto</th>
                      <th className="px-6 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productOrders.filter(o => o.status !== 'DELIVERED').map(order => (
                      <tr key={order.id} className="text-xs hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900">{order.user?.full_name}</div>
                          <div className="text-[9px] text-slate-500 font-medium italic">{order.delivery_address || order.user?.address}</div>
                          <div className="text-[9px] font-black text-blue-600 uppercase mt-1">Tel: {order.user?.phone || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{order.product?.name}</div>
                          <div className="text-[9px] text-slate-400 uppercase font-black">Cant: {order.quantity || 1}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleMarkAsDelivered(order.id)}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-black uppercase text-[9px] hover:bg-green-700 transition shadow-sm"
                          >
                            Entregado
                          </button>
                        </td>
                      </tr>
                    ))}
                    {productOrders.filter(o => o.status !== 'DELIVERED').length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400 font-bold uppercase text-[9px]">No hay entregas pendientes</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders_admin' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden animate-fade-in">
          <AliadoOrders user={user} />
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1500px]">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Usuario / Perfil</th>
                  <th className="px-6 py-4">DUI / Documento</th>
                  <th className="px-6 py-4">Información Personal</th>
                  <th className="px-6 py-4">Banco y Cuenta</th>
                  <th className="px-6 py-4">Estatus</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="text-xs hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={u.profile_image_url || `https://ui-avatars.com/api/?name=${u.full_name}`} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100" alt="P" />
                        <div>
                          <div className="font-black text-slate-900">{u.full_name}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Aprobado: {new Date(u.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{u.dui}</div>
                      <a href={u.dui_url} target="_blank" rel="noreferrer" className="block mt-1">
                        <img src={u.dui_url || undefined} className="w-12 h-8 object-cover rounded border border-slate-200" alt="DUI" />
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-600 mb-0.5">Dir: <span className="font-medium">{u.address}</span></div>
                      <div className="font-bold text-slate-600">Trabajo: <span className="font-medium italic">{u.workplace || 'Privado'}</span></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-700 uppercase tracking-tight">{u.bank_name || 'N/A'}</div>
                      <div className="font-mono text-slate-500 font-bold mt-0.5">{u.bank_account || 'Sin cuenta'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${u.is_verified ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                          <span className="font-black uppercase text-[9px] tracking-widest">{u.is_verified ? 'Verificado' : 'Pendiente'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${u.calculated_status === 'Moroso' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                          <span className="font-black uppercase text-[9px] tracking-widest">{u.calculated_status}</span>
                        </div>
                        <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block">Score: {u.reliability_score}%</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleInconsistencyEmail(u, 'perfil y documentación')}
                        className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition shadow-sm border border-red-100"
                        title="Informar Inconsistencia"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'avatares' && (
        <AvataresAdminPanel user={user} />
      )}

      {activeTab === 'active_loans' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-4">Usuario</th>
                <th className="px-8 py-4">Aprobación Préstamo</th>
                <th className="px-8 py-4">Monto Base</th>
                <th className="px-8 py-4">Monto a Pagar al Banco a la Fecha</th>
                <th className="px-8 py-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeLoansList.map(loan => (
                <tr key={loan.id} className="text-sm hover:bg-slate-50 transition">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <img src={loan.user?.profile_image_url || `https://ui-avatars.com/api/?name=${loan.user?.full_name}`} className="w-8 h-8 rounded-full object-cover" alt="U" />
                      <span className="font-bold text-slate-900">{loan.user?.full_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-slate-500 font-bold uppercase tracking-tight text-xs">
                    {loan.approved_at ? new Date(loan.approved_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-8 py-4 font-black text-slate-400 text-base">
                    $25.00
                  </td>
                  <td className="px-8 py-4">
                    <span className={`font-black text-lg ${calculateTotalDue(loan) > 30 ? 'text-red-600' : 'text-blue-600'}`}>
                      ${calculateTotalDue(loan).toFixed(2)}
                    </span>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Incluye Interés y Mora Actualizada</div>
                  </td>
                  <td className="px-8 py-4">
                    <button 
                      onClick={() => handleInconsistencyEmail(loan.user, 'préstamo activo')}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition shadow-sm border border-red-100"
                      title="Notificar Inconsistencia"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {activeLoansList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay préstamos activos registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'control_global_pagos' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center bg-indigo-50/30 gap-4">
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-xs">1. Seleccionar Ahorros Respaldantes</h3>
                <p className="text-[9px] text-indigo-600 font-bold uppercase mt-1">Obligatorio para marcar como "DESEMBOLSADO"</p>
              </div>
              <span className="text-[10px] font-black text-indigo-600 bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                Liquidez Total: ${stats.total_savings.toFixed(2)}
              </span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto pr-2">
                {activeSavings.map(s => (
                  <label key={s.id} className={`flex items-center justify-between p-3 border rounded-2xl hover:bg-slate-50 cursor-pointer transition-all ${selectedSavingIds.includes(s.id) ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-100' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedSavingIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSavingIds([...selectedSavingIds, s.id]);
                          else setSelectedSavingIds(selectedSavingIds.filter(id => id !== s.id));
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-900 leading-tight">{s.user?.full_name}</span>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">DUI: {s.user?.dui}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-black text-slate-900 block">${s.amount.toFixed(2)}</span>
                      <span className="text-[8px] text-green-600 font-bold uppercase block">Estado Real: ${calculateRealBalance(s).toFixed(2)}</span>
                      <span className="text-[7px] text-slate-400 font-black uppercase">(Solo Admin)</span>
                    </div>
                  </label>
                ))}
              </div>
              {selectedSavingIds.length > 0 && (
                <div className="mt-6 p-4 bg-slate-900 rounded-2xl flex justify-between items-center shadow-lg shadow-slate-200">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Respaldo a tomar de los seleccionados:</span>
                     <span className="text-[9px] text-slate-500 italic mt-0.5">La disminución se verá reflejada en el Estado Real del Admin</span>
                   </div>
                   <span className="text-xl font-black text-white">
                     ${activeSavings.filter(s => selectedSavingIds.includes(s.id)).reduce((acc, s) => acc + calculateRealBalance(s), 0).toFixed(2)}
                   </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden mt-8">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">2. Control Global de Historial</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Acciones de Desembolso Directo</p>
              </div>
              <div className="relative w-full sm:w-80">
                <input 
                  type="text" 
                  placeholder="Buscar por número de DUI..." 
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                  value={searchDui}
                  onChange={(e) => setSearchDui(e.target.value)}
                />
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1500px]">
                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">Nombre completo de Usuario</th>
                    <th className="px-8 py-5">Identificador del prestamo</th>
                    <th className="px-8 py-5">Cuenta de Banco</th>
                    <th className="px-8 py-5">Monto total a pagar a la fecha</th>
                    <th className="px-8 py-5">Hora y fecha del registro</th>
                    <th className="px-8 py-5">Fecha de pago</th>
                    <th className="px-8 py-5">Comprobante</th>
                    <th className="px-8 py-5">Estado</th>
                    <th className="px-8 py-5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allLoans.filter(l => l.user?.dui?.toLowerCase().includes(searchDui.toLowerCase())).map(loan => (
                    <tr key={loan.id} className="text-sm hover:bg-slate-50/80 transition">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <img src={loan.user?.profile_image_url || `https://ui-avatars.com/api/?name=${loan.user?.full_name}`} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" alt="U" />
                          <div>
                            <div className="font-bold text-slate-900">{loan.user?.full_name || 'Desconocido'}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase">{loan.user?.dui || 'Sin DUI'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <code className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-600">#{loan.id.slice(0,8).toUpperCase()}</code>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-mono text-slate-600 font-bold text-xs">{loan.user?.bank_account || 'Sin cuenta'}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{loan.user?.bank_name || 'N/A'}</div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-black text-slate-900 text-lg">${calculateTotalDue(loan).toFixed(2)}</div>
                        <div className={`text-[9px] font-black uppercase ${loan.status === 'DEFAULTED' ? 'text-red-500' : 'text-slate-400'}`}>Estado Interno: {loan.status}</div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-[11px] font-bold text-slate-700">{new Date(loan.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] font-medium text-slate-400">{new Date(loan.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-[11px] font-bold text-blue-600">{new Date(loan.due_date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-8 py-4">
                        {loan.payment_voucher_url ? (
                          <a href={loan.payment_voucher_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 group">
                            <img src={loan.payment_voucher_url || undefined} className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-sm transition group-hover:ring-2 group-hover:ring-blue-500" alt="Comprobante" />
                            <span className="text-[10px] font-black text-blue-600 uppercase group-hover:underline">Ver Imagen</span>
                          </a>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase italic">Sin registro de pago</span>
                        )}
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          loan.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                          loan.status === 'PAID' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                          loan.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-700' :
                          loan.status === 'DEFAULTED' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button 
                            disabled={selectedSavingIds.length === 0}
                            onClick={() => handleApproveLoanWithSavings(loan.id, loan.amount)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition ${
                              selectedSavingIds.length === 0 
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-green-100'
                            }`}
                          >
                            Marcar como Desembolsado
                          </button>
                          <button 
                            onClick={() => handleNotifyTransferEmail(loan)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                          >
                            Notificar Transferencia
                          </button>
                          <button 
                            onClick={() => handleToggleDuiVisibility(loan.user)}
                            className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition"
                          >
                            {loan.user?.is_hidden ? 'Mostrar Avales' : 'Ocultar Avales'}
                          </button>
                          <button 
                            onClick={() => handleGlobalReject(loan)}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition"
                          >
                            Marcar como No Desembolsado
                          </button>
                          <div className="flex flex-col gap-1 w-full mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cambiar Tipo Perfil:</span>
                            <select 
                              className="bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase p-1.5 outline-none focus:ring-2 focus:ring-blue-400"
                              value={loan.user?.profile_type || 'invitado'}
                              onChange={(e) => handleUpdateProfileType(loan.user?.id, e.target.value)}
                              disabled={actionLoading === (loan.user?.id + '-profile')}
                            >
                              <option value="invitado">Invitado</option>
                              <option value="estudiante">Estudiante</option>
                              <option value="especialista">Especialista</option>
                              <option value="inversionista">Inversionista</option>
                              <option value="MYPE">MYPE</option>
                              <option value="jugador">Jugador</option>
                              <option value="ayudame">Ayúdame</option>
                              <option value="creditos">Créditos</option>
                            </select>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allLoans.filter(l => l.user?.dui?.toLowerCase().includes(searchDui.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay registros para mostrar bajo este filtro</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'control_total' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Panel de Control Global de Préstamos</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Historial completo sin importar el estado del pago</p>
            </div>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Filtrar por DUI del usuario..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                value={searchDui}
                onChange={(e) => setSearchDui(e.target.value)}
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1200px]">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                <tr>
                  <th className="px-8 py-4">Usuario</th>
                  <th className="px-8 py-4">DUI</th>
                  <th className="px-8 py-4">Monto Base</th>
                  <th className="px-8 py-4">Estado Actual</th>
                  <th className="px-8 py-4">Comprobante de Transferencia</th>
                  <th className="px-8 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredControlTotal.map(loan => (
                  <tr key={loan.id} className="text-sm hover:bg-slate-50 transition">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <img src={loan.user?.profile_image_url || `https://ui-avatars.com/api/?name=${loan.user?.full_name}`} className="w-8 h-8 rounded-full object-cover border border-slate-100 shadow-sm" alt="U" />
                        <span className="font-bold text-slate-900">{loan.user?.full_name || 'Desconocido'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 font-mono text-slate-600 font-bold text-xs">{loan.user?.dui || 'N/A'}</td>
                    <td className="px-8 py-4 font-black text-slate-900">$25.00</td>
                    <td className="px-8 py-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        loan.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                        loan.status === 'PAID' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        loan.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-700' :
                        loan.status === 'DEFAULTED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      {loan.payment_voucher_url ? (
                        <a href={loan.payment_voucher_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 group">
                          <img src={loan.payment_voucher_url || undefined} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm transition group-hover:scale-105" alt="Voucher" />
                          <span className="text-[10px] font-black text-blue-600 uppercase group-hover:underline">Ver Imagen</span>
                        </a>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Sin comprobante</span>
                      )}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleVerifyLoanPayment(loan.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-green-700 transition"
                        >
                          Aprobar Pago
                        </button>
                        <button 
                          onClick={() => handleRejectPayment(loan)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 transition"
                        >
                          Reportar Inconsistencia
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredControlTotal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay registros para mostrar bajo este filtro</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'validacion_pagos' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-green-50/30">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Validación de Pagos (En Revisión)</h3>
            <span className="text-[10px] font-black text-green-600 bg-white px-3 py-1 rounded-full border border-green-100 shadow-sm">
              Confirmación de Transferencias Bancarias
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                <tr>
                  <th className="px-8 py-4">Nombre completo de Usuario</th>
                  <th className="px-8 py-4">Monto Base</th>
                  <th className="px-8 py-4">Fecha aprobacion del prestamo</th>
                  <th className="px-8 py-4">vista previa del Comprobante</th>
                  <th className="px-8 py-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {verifyPaymentsList.map(loan => (
                  <tr key={loan.id} className="text-sm hover:bg-slate-50 transition">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <img src={loan.user?.profile_image_url || `https://ui-avatars.com/api/?name=${loan.user?.full_name}`} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 shadow-sm" alt="U" />
                        <span className="font-bold text-slate-900">{loan.user?.full_name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 font-black text-slate-900">$25.00</td>
                    <td className="px-8 py-4 text-slate-500 text-xs font-bold uppercase">
                      {loan.approved_at ? new Date(loan.approved_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-8 py-4">
                      {loan.payment_voucher_url ? (
                        <a href={loan.payment_voucher_url} target="_blank" rel="noreferrer" className="block w-16 h-16 group relative">
                          <img src={loan.payment_voucher_url || undefined} className="w-full h-full object-cover rounded-xl border border-slate-100 transition-transform group-hover:scale-105" alt="Voucher" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                        </a>
                      ) : <span className="text-[10px] font-bold text-slate-300">SIN IMAGEN</span>}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleVerifyLoanPayment(loan.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition"
                        >
                          Aprobar
                        </button>
                        <button 
                          onClick={() => handleRejectPayment(loan)}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition"
                          title="Informar que no se ha registrado el pago"
                        >
                          Reportar Inconsistencia
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {verifyPaymentsList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay solicitudes en estado 'En Revisión'</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'all_loans' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Historial Total de Préstamos</h3>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Filtrar por DUI..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={searchDui}
                onChange={(e) => setSearchDui(e.target.value)}
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                <tr>
                  <th className="px-8 py-4">Usuario</th>
                  <th className="px-8 py-4">DUI</th>
                  <th className="px-8 py-4">Monto Base</th>
                  <th className="px-8 py-4">Fecha Solicitud</th>
                  <th className="px-8 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAllLoans.map(loan => (
                  <tr key={loan.id} className="text-sm hover:bg-slate-50 transition">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <img src={loan.user?.profile_image_url || `https://ui-avatars.com/api/?name=${loan.user?.full_name}`} className="w-8 h-8 rounded-full object-cover border border-slate-100" alt="U" />
                        <span className="font-bold text-slate-900">{loan.user?.full_name || 'Desconocido'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 font-mono text-slate-600 font-bold text-xs">{loan.user?.dui || 'N/A'}</td>
                    <td className="px-8 py-4 font-black text-slate-900">$25.00</td>
                    <td className="px-8 py-4 text-slate-500 text-xs font-bold uppercase">{new Date(loan.created_at).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        loan.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                        loan.status === 'PAID' ? 'bg-blue-100 text-blue-700' :
                        loan.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-700' :
                        loan.status === 'DEFAULTED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredAllLoans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No se encontraron préstamos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'saving_vouchers' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-4">Usuario</th>
                <th className="px-8 py-4">Monto</th>
                <th className="px-8 py-4">Fecha/Hora</th>
                <th className="px-8 py-4">Comprobante</th>
                <th className="px-8 py-4">Validación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {savingVouchers.map(s => (
                <tr key={s.id} className="text-sm hover:bg-slate-50 transition">
                  <td className="px-8 py-4 font-bold">{s.user?.full_name}</td>
                  <td className="px-8 py-4 font-black text-slate-900">${s.amount.toFixed(2)}</td>
                  <td className="px-8 py-4 text-slate-500">{s.deposit_date} {s.deposit_time}</td>
                  <td className="px-8 py-4">
                    <a href={s.voucher_url} target="_blank" rel="noreferrer">
                      <img src={s.voucher_url || undefined} className="w-12 h-12 object-cover rounded-lg border border-slate-200" alt="Voucher" />
                    </a>
                  </td>
                  <td className="px-8 py-4 flex gap-2">
                    <button onClick={() => handleApproveSaving(s)} className="px-3 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100">Aprobar</button>
                    <button onClick={() => handleReportSavingError(s)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase">Reportar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'active_savings' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-4">Usuario</th>
                <th className="px-8 py-4">Aprobación</th>
                <th className="px-8 py-4">Monto Base</th>
                <th className="px-8 py-4">Total Real (Estado)</th>
                <th className="px-8 py-4">Cuenta Banco</th>
                <th className="px-8 py-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeSavings.map(s => (
                <tr key={s.id} className="text-sm hover:bg-slate-50 transition">
                  <td className="px-8 py-4 font-bold">{s.user?.full_name}</td>
                  <td className="px-8 py-4 text-slate-500">{s.approved_at ? new Date(s.approved_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-8 py-4 font-black text-slate-400">${s.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <div className="font-black text-green-600">${calculateRealBalance(s).toFixed(2)}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estado Real / Administrador</div>
                  </td>
                  <td className="px-8 py-4 font-mono text-slate-600">{s.user?.bank_account || 'Sin cuenta'}</td>
                  <td className="px-8 py-4 flex gap-2">
                    <button onClick={() => handleReturnSaving(s)} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Devolver Ahorro</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'return_vouchers' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden animate-fade-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-4">Nombre Completo</th>
                <th className="px-8 py-4">Fecha Aprobación</th>
                <th className="px-8 py-4">Monto Base</th>
                <th className="px-8 py-4">Total Vigente a la Fecha</th>
                <th className="px-8 py-4">Cuenta Banco</th>
                <th className="px-8 py-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {returnRequests.map(s => (
                <tr key={s.id} className="text-sm hover:bg-slate-50 transition">
                  <td className="px-8 py-4 font-bold text-slate-900">{s.user?.full_name}</td>
                  <td className="px-8 py-4 text-slate-500 font-bold uppercase tracking-tight text-xs">{s.approved_at ? new Date(s.approved_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-8 py-4 font-black text-slate-400">${s.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <span className="font-black text-indigo-600 text-lg">${calculateSavingTotal(s).toFixed(2)}</span>
                    <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Rendimiento 1% mensual</div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="font-black text-slate-700 uppercase text-[10px] tracking-tight">{s.user?.bank_name || 'Desconocido'}</div>
                    <div className="font-mono text-slate-500 font-bold text-xs">{s.user?.bank_account || 'Sin cuenta'}</div>
                  </td>
                  <td className="px-8 py-4 flex gap-2">
                    <button onClick={() => handleReturnSaving(s)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition">Devolver Ahorro</button>
                    <button onClick={() => handleReportSavingError(s)} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition" title="Notificar Inconsistencia">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50/30">
            <h3 className="font-bold text-slate-900 uppercase tracking-widest text-xs">Vínculo de Ahorros con Préstamos</h3>
            <span className="text-[10px] font-black text-indigo-600 bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
              Liquidez del Fondo: ${stats.total_savings.toFixed(2)}
            </span>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">1. Seleccionar Ahorros Respaldantes</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {activeSavings.map(s => (
                  <label key={s.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedSavingIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSavingIds([...selectedSavingIds, s.id]);
                          else setSelectedSavingIds(selectedSavingIds.filter(id => id !== s.id));
                        }}
                      />
                      <span className="text-xs font-bold text-slate-700">{s.user?.full_name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">${calculateRealBalance(s).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">2. Aprobar Solicitudes</h4>
              {approvedLoans.map(loan => (
                <div key={loan.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-xs">{loan.user?.full_name}</div>
                    <div className="text-[10px] text-blue-600 font-black tracking-widest">PEDIDO: ${loan.amount}</div>
                  </div>
                  <button 
                    disabled={selectedSavingIds.length === 0}
                    onClick={() => handleApproveLoanWithSavings(loan.id, loan.amount)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition shadow-lg ${
                      selectedSavingIds.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                    }`}
                  >Desembolsar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;