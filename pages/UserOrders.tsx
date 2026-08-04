import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';

interface UserOrdersProps {
  user: any;
}

const UserOrders: React.FC<UserOrdersProps> = ({ user }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'procesando' | 'entregados'>('procesando');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, { address: string; phone: string }>>({});

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user?.id]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_orders')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      
      // Initialize editing data
      const initialEditing: Record<string, { address: string; phone: string }> = {};
      data?.forEach(order => {
        initialEditing[order.id] = {
          address: order.delivery_address || user.address || '',
          phone: order.contact_phone || user.phone || ''
        };
      });
      setEditingData(initialEditing);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderInfo = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const { address, phone } = editingData[orderId];
      const { error } = await supabase
        .from('product_orders')
        .update({
          delivery_address: address,
          contact_phone: phone
        })
        .eq('id', orderId);

      if (error) throw error;
      alert("Información de entrega actualizada correctamente.");
      fetchOrders();
    } catch (err) {
      console.error("Error updating order info:", err);
      alert("Error al actualizar la información.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'procesando') return order.status !== 'DELIVERED';
    if (activeTab === 'entregados') return order.status === 'DELIVERED';
    return false;
  });

  const getItemsCountByType = (filteredOrders: any[]) => {
    const summary: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const name = o.product?.name || 'Otro';
      summary[name] = (summary[name] || 0) + (o.quantity || 1);
    });
    return summary;
  };

  const trackingSteps = [
    { id: 'payment', label: 'Se recibió el pago de tu pedido correctamente', field: 'tracking_payment_received_at' },
    { id: 'items', label: 'Se seleccionaron los artículos', field: 'tracking_items_selected_at' },
    { id: 'shipped_list', label: 'Se añadió tu pedido a la lista de envíos', field: 'tracking_shipped_list_added_at' },
    { id: 'transit', label: 'Tu pedido se encuentra en camino hacia la dirección que proporcionaste', field: 'tracking_in_transit_at' },
    { id: 'delivered', label: 'Tu pedido fue entregado', field: 'tracking_delivered_at' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-2">Mis Pedidos</h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Estado y seguimiento de tus compras</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {(['procesando', 'entregados'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-10 py-4 rounded-2xl font-black uppercase text-xs transition-all duration-300 ${
              activeTab === tab 
                ? 'bg-blue-600 text-white shadow-xl scale-105 shadow-blue-200' 
                : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-600 hover:text-blue-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Resumen de Artículos */}
      {filteredOrders.length > 0 && (
        <div className="bg-slate-900/5 p-6 rounded-3xl border border-slate-200 mb-8 backdrop-blur-sm">
          <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Resumen de productos en esta sección:</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(getItemsCountByType(filteredOrders)).map(([type, count]) => (
              <div key={type} className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                <span className="text-xs font-bold text-slate-600">{type}:</span>
                <span className="ml-2 text-xs font-black text-blue-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin text-4xl mb-4">💎</div>
          <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Consultando tus pedidos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          <AnimatePresence mode="wait">
            {filteredOrders.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-300"
              >
                <div className="text-4xl mb-4">🛒</div>
                <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">No tienes pedidos en esta categoría</p>
              </motion.div>
            ) : (
              filteredOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100 hover:shadow-blue-100 transition-all flex flex-col gap-8 relative overflow-hidden"
                >
                  {/* Dekoración de fondo */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 -z-10 opacity-50" />
                  
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sección Izquierda: Producto y detalles básicos */}
                    <div className="lg:w-1/3 w-full">
                      <div className="relative group overflow-hidden rounded-[2rem] mb-6 aspect-square shadow-lg">
                        <img 
                          src={order.product?.image_urls?.[0] || 'https://picsum.photos/seed/product/400/400'} 
                          alt={order.product?.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/50">
                          <span className="text-[10px] font-black text-slate-900 uppercase">Cantidad: {order.quantity || 1}</span>
                        </div>
                        <div className="absolute bottom-4 right-4 bg-slate-900 px-4 py-2 rounded-2xl shadow-lg">
                          <span className="text-white font-black text-base">${order.total_price?.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-6">
                        <h3 className="text-xl font-black text-slate-900 leading-tight">{order.product?.name}</h3>
                        <p className="text-sm text-slate-500 italic line-clamp-3">{order.product?.description}</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">ID DE PEDIDO</span>
                        <div className="text-[10px] font-mono font-bold text-slate-600 break-all">{order.general_order_id || order.id}</div>
                      </div>
                    </div>

                    {/* Sección Derecha: Información de entrega y Rastreo */}
                    <div className="lg:w-2/3 w-full flex flex-col gap-8">
                      {activeTab === 'procesando' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest block ml-1">Dirección de Envío</label>
                            <textarea 
                              className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                              placeholder="Ingresa tu dirección exacta para el envío..."
                              value={editingData[order.id]?.address || ''}
                              onChange={(e) => setEditingData({...editingData, [order.id]: {...editingData[order.id], address: e.target.value}})}
                            />
                          </div>
                          <div className="space-y-2 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest block ml-1">Teléfono de Contacto</label>
                            <input 
                              type="text"
                              className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              placeholder="Número de WhatsApp o Llamada"
                              value={editingData[order.id]?.phone || ''}
                              onChange={(e) => setEditingData({...editingData, [order.id]: {...editingData[order.id], phone: e.target.value}})}
                            />
                            <button 
                              disabled={updatingId === order.id}
                              onClick={() => updateOrderInfo(order.id)}
                              className="mt-auto w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {updatingId === order.id ? 'Guardando...' : 'Actualizar mis datos'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Panel de Rastreo */}
                      <div className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-blue-50 rounded-xl">
                            <span className="text-xl">📍</span>
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Rastrear Pedido</h4>
                        </div>
                        
                        <div className="space-y-4">
                          {activeTab === 'entregados' ? (
                            <div className="flex items-center gap-4 p-5 rounded-3xl bg-green-50 border-2 border-green-100">
                              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-lg">✓</div>
                              <div>
                                <div className="text-xs font-black text-green-800 uppercase tracking-tight">¡Pedido Entregado!</div>
                                <div className="text-[10px] font-bold text-green-600 mt-0.5">
                                  Tu pedido fue entregado el {order.tracking_delivered_at || 'la fecha indicada por el aliado'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {trackingSteps.map((step) => {
                                const isActive = !!order[step.field];
                                return (
                                  <div
                                    key={step.id}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                                      isActive 
                                        ? 'bg-green-50 border-green-100 text-green-700 shadow-sm' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300'
                                    }`}
                                  >
                                    <div className="flex flex-col items-start text-left">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-200'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-tight">{step.label}</span>
                                      </div>
                                      {isActive && (
                                        <div className="text-[8px] font-bold opacity-70 mt-1 ml-6">
                                          {order[step.field]}
                                        </div>
                                      )}
                                    </div>
                                    {isActive && <span className="text-green-500">✔</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
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

export default UserOrders;
