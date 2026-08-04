import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';

interface AliadoOrdersProps {
  user: any;
}

const AliadoOrders: React.FC<AliadoOrdersProps> = ({ user }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'procesando' | 'entregados'>('pendientes');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [user.id]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase.from('product_orders').select('*, user:profiles(*), product:products(*)');

      // Si no es admin, filtramos solo por los productos que tiene asignados
      if (!user.is_admin) {
        const { data: myProducts } = await supabase
          .from('products')
          .select('id')
          .eq('creator_id', user.id);

        const productIds = myProducts?.map(p => p.id) || [];

        if (productIds.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }
        query = query.in('product_id', productIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateTracking = async (orderId: string, step: string) => {
    setUpdatingId(orderId);
    try {
      const now = new Date().toLocaleString('es-SV', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const updateData: any = {};
      if (step === 'payment') updateData.tracking_payment_received_at = now;
      if (step === 'items') updateData.tracking_items_selected_at = now;
      if (step === 'shipped_list') updateData.tracking_shipped_list_added_at = now;
      if (step === 'transit') updateData.tracking_in_transit_at = now;
      if (step === 'delivered') {
        updateData.tracking_delivered_at = now;
        updateData.status = 'DELIVERED';
      }

      const { error } = await supabase
        .from('product_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error("Error updating tracking:", err);
      alert("Error al actualizar el estado. Asegúrate que las columnas de rastreo existan en la base de datos.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro de pedido entregado?")) return;
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('product_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error("Error deleting order:", err);
      alert("Error al eliminar el pedido.");
    } finally {
      setUpdatingId(null);
    }
  };

  const isModified = (order: any) => {
    return order.tracking_payment_received_at || 
           order.tracking_items_selected_at || 
           order.tracking_shipped_list_added_at || 
           order.tracking_in_transit_at || 
           order.tracking_delivered_at;
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pendientes') return !isModified(order);
    if (activeTab === 'procesando') return isModified(order) && !order.tracking_delivered_at;
    if (activeTab === 'entregados') return !!order.tracking_delivered_at;
    return false;
  });

  const getItemsCountByType = (filteredOrders: any[]) => {
    // Como no hay campo tipo, agrupamos por nombre de producto
    const summary: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const name = o.product?.name || 'Otro';
      summary[name] = (summary[name] || 0) + (o.quantity || 1);
    });
    return summary;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-2">Gestión de Pedidos</h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Panel Exclusivo para Aliados</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(['pendientes', 'procesando', 'entregados'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 rounded-2xl font-black uppercase text-xs transition-all duration-300 ${
              activeTab === tab 
                ? 'bg-slate-900 text-white shadow-xl scale-105' 
                : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-900 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Resumen de Artículos */}
      {filteredOrders.length > 0 && (
        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 mb-8">
          <h3 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-3">Resumen de la lista actual:</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(getItemsCountByType(filteredOrders)).map(([type, count]) => (
              <div key={type} className="bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-200">
                <span className="text-xs font-bold text-slate-600">{type}:</span>
                <span className="ml-2 text-xs font-black text-blue-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Cargando pedidos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="wait">
            {filteredOrders.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-300"
              >
                <div className="text-4xl mb-4">📦</div>
                <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">No hay pedidos en esta sección</p>
              </motion.div>
            ) : (
              filteredOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 hover:shadow-2xl transition-all group"
                >
                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* Info Pedido */}
                    <div className="lg:w-1/3 flex flex-col gap-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">ID PEDIDO</span>
                            <div className="text-[10px] font-mono font-bold text-slate-900 break-all">{order.general_order_id || order.id}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">FECHA</span>
                            <div className="text-xs font-bold text-slate-900">{new Date(order.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest block">Cliente</label>
                            <div className="font-black text-slate-900">{order.user?.full_name}</div>
                            <div className="text-[10px] font-bold text-slate-500">ID: {order.user?.id.slice(0,8)}...</div>
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest block">Contacto</label>
                            <div className="text-xs font-bold text-slate-700">📞 {order.user?.phone || 'No proporcionado'}</div>
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest block">Dirección de Envío</label>
                            <div className="text-xs font-bold text-slate-700 italic">📍 {order.delivery_address || order.user?.address || 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      {activeTab === 'entregados' && (
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <span>🗑️</span> Eliminar de Entregados
                        </button>
                      )}
                    </div>

                    {/* Info Producto */}
                    <div className="lg:w-2/3">
                      <div className="flex flex-col sm:flex-row gap-6 p-6 border border-slate-100 rounded-3xl mb-6">
                        <div className="sm:w-32 h-32">
                          <img 
                            src={order.product?.image_urls?.[0] || 'https://picsum.photos/seed/product/400/400'} 
                            alt={order.product?.name}
                            className="w-full h-full object-cover rounded-2xl shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-black text-lg text-slate-900">{order.product?.name}</h3>
                            <div className="bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-black">x{order.quantity || 1}</div>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-4 italic">{order.product?.description}</p>
                          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                            <span className="text-[10px] font-black uppercase text-slate-400">Total a Pagar:</span>
                            <span className="text-xl font-black text-green-600">${order.total_price?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Seguimiento */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs">📍</span>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Estado de Rastreo del Pedido</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { id: 'payment', label: 'Se recibió el pago de tu pedido correctamente', field: 'tracking_payment_received_at' },
                            { id: 'items', label: 'Se seleccionaron los artículos', field: 'tracking_items_selected_at' },
                            { id: 'shipped_list', label: 'Se añadió tu pedido a la lista de envíos', field: 'tracking_shipped_list_added_at' },
                            { id: 'transit', label: 'Tu pedido se encuentra en camino', field: 'tracking_in_transit_at' },
                            { id: 'delivered', label: 'Tu pedido fue entregado', field: 'tracking_delivered_at' },
                          ].map((step) => {
                            const isActive = !!order[step.field];
                            const canActivate = activeTab !== 'entregados';
                            
                            return (
                              <button
                                key={step.id}
                                disabled={updatingId === order.id || isActive || !canActivate}
                                onClick={() => updateTracking(order.id, step.id)}
                                className={`flex items-center justify-between p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${
                                  isActive 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex flex-col items-start text-left">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`} />
                                    <span>{step.label}</span>
                                  </div>
                                  {isActive && <div className="text-[8px] opacity-70 mt-1 ml-6">{order[step.field]}</div>}
                                </div>
                                {isActive && <span>✔️</span>}
                                {updatingId === order.id && !isActive && <span className="animate-spin text-blue-600">⏳</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AliadoOrders;
