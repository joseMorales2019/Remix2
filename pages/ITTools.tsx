import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import NetworkDiagram from '../components/NetworkDiagram';

interface ITCompany {
  id: string;
  name: string;
  created_at: string;
}

interface ITSection {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

interface ITEquipment {
  id: string;
  company_id: string;
  section_id: string;
  type: string;
  responsible: string;
  brand?: string;
  model?: string;
  serial?: string;
  status: string;
  hw_data?: any;
  sw_data?: any;
  net_data?: any;
  maintenance_history?: any[];
  created_at: string;
  description?: string;
}

const ITTools: React.FC<{ user: any }> = ({ user }) => {
  const [view, setView] = useState<'companies' | 'company_details' | 'form_pc' | 'form_component' | 'all_inventory' | 'manage_sections' | 'diagram'>('companies');
  const [companies, setCompanies] = useState<ITCompany[]>([]);
  const [sections, setSections] = useState<ITSection[]>([]);
  const [equipment, setEquipment] = useState<ITEquipment[]>([]);
  const [allEquipment, setAllEquipment] = useState<ITEquipment[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<ITCompany | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Shared Form States
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');

  // Equipment Form State
  const [compType, setCompType] = useState('Impresora');
  const [selectedSection, setSelectedSection] = useState('');
  const [filterType, setFilterType] = useState('Todos');

  const [editingEquipment, setEditingEquipment] = useState<ITEquipment | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data } = await supabase.from('it_companies').select('*').order('created_at', { ascending: false });
    if (data) setCompanies(data);
    setLoading(false);
  };

  const fetchAllEquipment = async () => {
    setLoading(true);
    const { data } = await supabase.from('it_equipment').select('*').order('created_at', { ascending: false });
    if (data) setAllEquipment(data);
    setLoading(false);
  };

  const fetchCompanyData = async (company: ITCompany) => {
    setLoading(true);
    const { data: comp } = await supabase.from('it_companies').select('*').eq('id', company.id).single();
    if (comp) {
      setSelectedCompany(comp);
      setCompanies(prev => prev.map(c => c.id === comp.id ? comp : c));
    }
    const { data: secs } = await supabase.from('it_sections').select('*').eq('company_id', company.id);
    const { data: equ } = await supabase.from('it_equipment').select('*').eq('company_id', company.id);
    if (secs) setSections(secs);
    if (equ) setEquipment(equ);
    setLoading(false);
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName) return;
    const { error } = await supabase.from('it_companies').insert([{ name: newCompanyName, owner_id: user.id }]);
    if (!error) {
      setNewCompanyName('');
      setShowAddCompanyModal(false);
      fetchCompanies();
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName || !selectedCompany) return;
    const { error } = await supabase.from('it_sections').insert([{ name: newSectionName, company_id: selectedCompany.id }]);
    if (!error) {
      setNewSectionName('');
      setShowAddSectionModal(false);
      fetchCompanyData(selectedCompany);
    }
  };

  const handleUpdateSection = async (id: string, newName: string) => {
    if (!newName || !selectedCompany) return;
    const { error } = await supabase.from('it_sections').update({ name: newName }).eq('id', id);
    if (!error) {
      fetchCompanyData(selectedCompany);
    } else {
      alert("Error actualizando departamento");
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta empresa? Esto eliminará departamentos y equipos asociados si está configurado en cascada.')) return;
    const { error } = await supabase.from('it_companies').delete().eq('id', id);
    if (!error) {
      fetchCompanies();
    } else {
      alert("Error eliminando empresa. Verifica que no tenga departamentos o equipos asociados.");
    }
  };

  const handleUpdateCompany = async (id: string, newName: string) => {
    if (!newName) return;
    const { error } = await supabase.from('it_companies').update({ name: newName }).eq('id', id);
    if (!error) {
      setEditingCompany(null);
      fetchCompanies();
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este departamento? Se eliminarán también los equipos asociados si la base de datos está configurada en cascada, o fallará si hay restricciones.')) return;
    const { error } = await supabase.from('it_sections').delete().eq('id', id);
    if (!error) {
      if (selectedCompany) fetchCompanyData(selectedCompany);
    } else {
      alert("Error eliminando departamento. Verifica que no tenga equipos asociados.");
    }
  };

  const deleteEquipment = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este equipo?')) return;
    const { error } = await supabase.from('it_equipment').delete().eq('id', id);
    if (!error) {
      if (view === 'all_inventory') fetchAllEquipment();
      else if (selectedCompany) fetchCompanyData(selectedCompany);
    }
  };

  const startEditing = (item: ITEquipment) => {
    setEditingEquipment(item);
    setCompType(item.type === 'PC' ? 'PC' : item.type);
    setSelectedSection(item.section_id);
    
    if (view === 'all_inventory') {
      const company = companies.find((c) => c.id === item.company_id);
      if (company) {
        setSelectedCompany(company);
        fetchCompanyData(company).then(() => {
          setView(item.type === 'PC' ? 'form_pc' : 'form_component');
        });
        return;
      }
    }
    setView(item.type === 'PC' ? 'form_pc' : 'form_component');
  };

  const downloadPDF = async (equipId: string) => {
    const item = allEquipment.find(e => e.id === equipId) || equipment.find(e => e.id === equipId);
    if (!item) return;

    const company = companies.find(c => c.id === item.company_id);
    const companyName = company ? company.name : '';
    const section = sections.find(s => s.id === item.section_id);
    const sectionName = section ? section.name : '';

    const doc = new jsPDF('p', 'mm', 'a4');

    const body: any[] = [];

    // Table Header Data
    body.push([{ content: companyName.toUpperCase() || 'NOMBRE DE LA EMPRESA', colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fontSize: 12 } }]);
    body.push([{ content: `FICHA TECNICA - ${item.type}`, colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 } }]);

    const addGeneralField = (label: string, value: string) => {
      body.push([
        { content: label, colSpan: 2 },
        { content: value, colSpan: 5 }
      ]);
    };

    addGeneralField("ID Registro :", item.id);
    addGeneralField("Responsable :", item.responsible || 'N/A');
    addGeneralField("Departamento :", sectionName || 'N/A');
    addGeneralField("Marca :", item.brand || 'N/A');
    addGeneralField("Modelo :", item.model || 'N/A');
    addGeneralField("Serial :", item.serial || 'N/A');
    addGeneralField("Estado :", item.status || 'N/A');
    if (item.description) {
      addGeneralField("Observaciones :", item.description);
    }
    addGeneralField("Fecha Registro :", new Date(item.created_at).toLocaleString());
    if (item.hw_data && item.hw_data.last_updated_at) {
      addGeneralField("Fecha Actualización :", new Date(item.hw_data.last_updated_at).toLocaleString());
    }

    const extractPairs = (obj: any): {key: string, value: any}[] => {
      let pairs: {key: string, value: any}[] = [];
      if (!obj) return pairs;
      if (typeof obj === 'object') {
        Object.entries(obj).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined && k !== 'last_updated_at') {
             pairs.push({key: k, value: v});
          }
        });
      } else {
        pairs.push({key: 'valor', value: obj});
      }
      return pairs;
    };

    const addSectionData = (title: string, dataObj: any) => {
      if (!dataObj || Object.keys(dataObj).length === 0) return;
      
      const keys = Object.keys(dataObj).filter(k => k !== 'last_updated_at' && dataObj[k] !== undefined && dataObj[k] !== null && dataObj[k] !== '');
      if (keys.length === 0) return;

      body.push([{ content: title, colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 } }]);

      keys.forEach(mainKey => {
         const val = dataObj[mainKey];
         const items = Array.isArray(val) ? val : [val];
         
         let isFirstRenderOfKey = true;

         items.forEach((itemObj: any) => {
             const pairs = extractPairs(itemObj);
             if (pairs.length === 0) {
                body.push([
                  { content: isFirstRenderOfKey ? mainKey.toUpperCase() : '', colSpan: 2, styles: { fontStyle: 'bold'} },
                  { content: String(itemObj), colSpan: 5 }
                ]);
                isFirstRenderOfKey = false;
                return;
             }

             const chunkSize = 6;
             for (let i = 0; i < pairs.length; i += chunkSize) {
                const chunk = pairs.slice(i, i + chunkSize);
                const rowUpper: any[] = [];
                const rowLower: any[] = [];
                
                if (isFirstRenderOfKey) {
                   rowUpper.push({ content: mainKey.toUpperCase(), rowSpan: 2, styles: { fontStyle: 'bold', valign: 'middle', halign: 'center'} });
                   isFirstRenderOfKey = false;
                } else {
                   rowUpper.push({ content: '', rowSpan: 2 });
                }

                for (let j = 0; j < 6; j++) {
                   if (j < chunk.length) {
                     rowUpper.push({ content: String(chunk[j].value), styles: { halign: 'center' } });
                     rowLower.push({ content: chunk[j].key, styles: { fontStyle: 'bold', halign: 'center' } });
                   } else {
                     rowUpper.push({ content: '', styles: { halign: 'center' } });
                     rowLower.push({ content: '', styles: { halign: 'center' } });
                   }
                }
                body.push(rowUpper);
                body.push(rowLower);
             }
         });
      });
    };

    if (item.hw_data) addSectionData("DATOS DE HARDWARE", item.hw_data);
    if (item.sw_data) addSectionData("DATOS DE SOFTWARE", item.sw_data);
    if (item.net_data) addSectionData("CONFIGURACION DE RED", item.net_data);
    
    if (item.maintenance_history && item.maintenance_history.length > 0) {
       body.push([{ content: "HISTORIAL DE MANTENIMIENTO", colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 } }]);
       item.maintenance_history.forEach((m: any, i: number) => {
         body.push([
           { content: `Servicio ${i+1}`, colSpan: 2, styles: { fontStyle: 'bold' } },
           { content: `${m.type || 'N/A'} - ${new Date(m.date).toLocaleString()} : ${m.description || m.comments || ''}`, colSpan: 5 }
         ]);
       });
    }

    autoTable(doc, {
      body: body,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 1,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: [0, 0, 0],
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 26 },
        2: { cellWidth: 26 },
        3: { cellWidth: 26 },
        4: { cellWidth: 26 },
        5: { cellWidth: 26 },
        6: { cellWidth: 26 },
      },
      margin: { top: 15, left: 10, right: 10 }
    });

    doc.save(`Ficha_Tecnica_${item.brand || 'Equipo'}_${item.serial || item.id}.pdf`);
  };

  const SelectOrInput = ({ value, options, onChange, className }: any) => {
    const isCustomValue = value && !options.includes(value);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [isCustom, setIsCustom] = useState(isCustomValue && value !== '');

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (value && !options.includes(value) && value !== '') setIsCustom(true);
    }, [value, options]);

    if (isCustom) {
      return (
        <div className="flex gap-1 items-center w-full">
          <input 
            autoFocus
            value={value} 
            onChange={onChange} 
            className={className + " flex-1"} 
            placeholder="Otra..." 
          />
          <button 
            type="button" 
            onClick={() => {
              setIsCustom(false);
              onChange({ target: { value: options[0] || '' } } as any);
            }} 
            className="text-red-500 font-bold px-1"
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <select 
        value={options.includes(value) ? value : ""} 
        onChange={(e) => {
          if (e.target.value === '___OTHER___') {
            setIsCustom(true);
            onChange({ target: { value: '' } } as any);
          } else {
            onChange(e);
          }
        }} 
        className={className}
      >
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="___OTHER___">Otra (ingresar manual)...</option>
      </select>
    );
  };

  const PCForm = () => {
    const [formData, setFormData] = useState<any>(() => {
      if (editingEquipment && editingEquipment.type === 'PC') {
        return {
          responsible: editingEquipment.responsible || '',
          model: editingEquipment.model || '',
          brand: editingEquipment.brand || '',
          serial: editingEquipment.serial || '',
          hw: editingEquipment.hw_data || {
            processor: { model: 'Intel Core i5', serial: '', cores: '4', status: 'Funcional', comments: '' },
            ram: [{ type: 'DDR4', capacity: '8GB', serial: '', status: 'Funcional', comments: '' }],
            disk: [{ type: 'SSD SATA', brand: 'Kingston', capacity: '240GB', serial: '', status: 'Funcional', comments: '' }],
            video: [{ type: 'Integrada', serial: '', status: 'Funcional', comments: '' }],
            sound: { brand: 'Realtek', model: 'High Definition Audio' },
            ports: [{ type: 'USB 3.0', quantity: '2', status: 'Funcional', comments: '' }],
            monitors: [{ model: '', serial: '', status: 'Funcional', comments: '' }],
            power_supply: { brand: '', serial: '', model: '', status: 'Funcional' },
            keyboard: { brand: '', model: '', status: 'Bueno', comments: '' },
            mouse: { brand: '', model: '', status: 'Bueno', comments: '' }
          },
          ups: (editingEquipment.hw_data && editingEquipment.hw_data.ups) ? editingEquipment.hw_data.ups : { brand: 'APC', model: '', serial: '', status: 'Operativo', comments: '' },
          maintenance: editingEquipment.maintenance_history || [],
          sw: editingEquipment.sw_data || { os: 'Windows 10 Pro', arch: '64-bit', comments: '' },
          net: editingEquipment.net_data || { ip: '', type: 'DHCP/Dinámica', mask: '', gateway: '', dns: '', port: '', comments: '' }
        };
      }
      return {
        responsible: '',
        model: '',
        brand: '',
        serial: '',
        hw: {
          processor: { model: 'Intel Core i5', serial: '', cores: '4', status: 'Funcional', comments: '' },
          ram: [{ type: 'DDR4', capacity: '8GB', serial: '', status: 'Funcional', comments: '' }],
          disk: [{ type: 'SSD SATA', brand: 'Kingston', capacity: '240GB', serial: '', status: 'Funcional', comments: '' }],
          video: [{ type: 'Integrada', serial: '', status: 'Funcional', comments: '' }],
          sound: { brand: 'Realtek', model: 'High Definition Audio' },
          ports: [{ type: 'USB 3.0', quantity: '2', status: 'Funcional', comments: '' }],
          monitors: [{ model: '', serial: '', status: 'Funcional', comments: '' }],
          power_supply: { brand: '', serial: '', model: '', status: 'Funcional' },
          keyboard: { brand: '', model: '', status: 'Bueno', comments: '' },
          mouse: { brand: '', model: '', status: 'Bueno', comments: '' }
        },
        ups: { brand: 'APC', model: '', serial: '', status: 'Operativo', comments: '' },
        maintenance: [],
        sw: { os: 'Windows 10 Pro', arch: '64-bit', comments: '' },
        net: { ip: '', type: 'DHCP/Dinámica', mask: '', gateway: '', dns: '', port: '', comments: '' }
      };
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSection) {
        alert("Selecciona un departamento");
        return;
      }
      
      const hwDataToSave = { ...formData.hw, ups: formData.ups };
      
      const payload = {
        company_id: selectedCompany?.id,
        section_id: selectedSection,
        type: 'PC',
        responsible: formData.responsible,
        brand: formData.brand,
        model: formData.model,
        serial: formData.serial,
        status: 'Funcional',
        hw_data: hwDataToSave,
        sw_data: formData.sw,
        net_data: formData.net,
        maintenance_history: formData.maintenance
      };

      let error;
      if (editingEquipment) {
        payload.hw_data.last_updated_at = new Date().toISOString();
        const res = await supabase.from('it_equipment').update(payload).eq('id', editingEquipment.id);
        error = res.error;
      } else {
        const res = await supabase.from('it_equipment').insert([payload]);
        error = res.error;
      }

      if (!error) {
        setEditingEquipment(null);
        setView('company_details');
        if (selectedCompany) fetchCompanyData(selectedCompany);
        if (view === 'all_inventory') fetchAllEquipment();
      } else {
        alert("Error guardando PC");
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-4 sm:p-8 rounded-3xl shadow-xl shadow-slate-100 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 uppercase">{editingEquipment ? 'Editar PC' : 'Agregar Nueva PC'}</h2>
          <button type="button" onClick={() => { setEditingEquipment(null); setView('company_details'); }} className="text-slate-400 hover:text-slate-900 transition-all font-bold text-sm">Cerrar</button>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-blue-600 pb-1 w-fit">
            <span className="text-xl">🏢</span>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Datos de Empresa</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Empresa</label>
              <input type="text" readOnly value={selectedCompany?.name} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-600 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Sección/Departamento</label>
              <select 
                required
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all"
              >
                <option value="">Seleccionar...</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Responsable del Equipo</label>
            <input 
              required
              type="text" 
              value={formData.responsible}
              onChange={(e) => setFormData({...formData, responsible: e.target.value})}
              placeholder="Nombre completo"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all" 
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-blue-600 pb-1 w-fit">
            <span className="text-xl">💻</span>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Datos Generales PC</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Marca</label>
              <input type="text" value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Modelo</label>
              <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Serial</label>
              <input type="text" value={formData.serial} onChange={(e) => setFormData({...formData, serial: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold" />
            </div>
          </div>
        </section>

        {/* Procesador */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <h4 className="font-black text-slate-900 uppercase text-xs">🛠️ Procesador</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectOrInput 
              options={['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'Xeon', 'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'Threadripper']}
              value={formData.hw.processor.model} onChange={(e:any) => setFormData({...formData, hw: {...formData.hw, processor: {...formData.hw.processor, model: e.target.value}}})} className="p-2 rounded-xl font-bold text-xs" />
            <input placeholder="Serial" value={formData.hw.processor.serial} onChange={e => setFormData({...formData, hw: {...formData.hw, processor: {...formData.hw.processor, serial: e.target.value}}})} className="p-2 rounded-xl font-bold text-xs" />
            <SelectOrInput 
              options={['2', '4', '6', '8', '10', '12', '16', '24', '32', '+']}
              value={formData.hw.processor.cores} onChange={(e:any) => setFormData({...formData, hw: {...formData.hw, processor: {...formData.hw.processor, cores: e.target.value}}})} className="p-2 rounded-xl font-bold text-xs" />
            <SelectOrInput 
              options={['Nuevo', 'Funcional', 'Dañado', 'Obsoleto']}
              value={formData.hw.processor.status} onChange={(e:any) => setFormData({...formData, hw: {...formData.hw, processor: {...formData.hw.processor, status: e.target.value}}})} className="p-2 rounded-xl font-bold text-xs" />
          </div>
          <input placeholder="Comentarios (opcional)" value={formData.hw.processor.comments || ''} onChange={e => setFormData({...formData, hw: {...formData.hw, processor: {...formData.hw.processor, comments: e.target.value}}})} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
        </section>

        {/* RAM */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">💾 Memoria RAM</h4>
            <button type="button" onClick={() => setFormData({...formData, hw: {...formData.hw, ram: [...formData.hw.ram, { type: 'DDR4', capacity: '8GB', serial: '', status: 'Funcional', comments: '' }]}})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar RAM</button>
          </div>
          {formData.hw.ram.map((r: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                 <SelectOrInput options={['DDR3', 'DDR4', 'DDR5']} value={r.type} onChange={(e:any) => { const n = [...formData.hw.ram]; n[idx].type = e.target.value; setFormData({...formData, hw: {...formData.hw, ram: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 <SelectOrInput options={['4GB', '8GB', '16GB', '32GB', '64GB', '+']} value={r.capacity} onChange={(e:any) => { const n = [...formData.hw.ram]; n[idx].capacity = e.target.value; setFormData({...formData, hw: {...formData.hw, ram: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 <input placeholder="Serial" value={r.serial} onChange={e => { const n = [...formData.hw.ram]; n[idx].serial = e.target.value; setFormData({...formData, hw: {...formData.hw, ram: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 <SelectOrInput options={['Nuevo', 'Funcional', 'Dañado']} value={r.status} onChange={(e:any) => { const n = [...formData.hw.ram]; n[idx].status = e.target.value; setFormData({...formData, hw: {...formData.hw, ram: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
              </div>
              <input placeholder="Comentarios (opcional)" value={r.comments || ''} onChange={e => { const n = [...formData.hw.ram]; n[idx].comments = e.target.value; setFormData({...formData, hw: {...formData.hw, ram: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* Almacenamiento */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">💽 Disco Duro</h4>
            <button type="button" onClick={() => setFormData({...formData, hw: {...formData.hw, disk: [...formData.hw.disk, { type: 'SSD SATA', brand: 'Kingston', capacity: '240GB', serial: '', status: 'Funcional', comments: '' }]}})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar Disco</button>
          </div>
          {formData.hw.disk.map((d: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
               <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end mb-2">
                 <div className="col-span-1">
                   <label className="text-[8px] font-black uppercase text-slate-400">Tipo</label>
                   <SelectOrInput options={['SSD SATA', 'SSD M.2 NVMe', 'HDD SATA', 'HDD SAS', 'Híbrido']} value={d.type} onChange={(e:any) => { const n = [...formData.hw.disk]; n[idx].type = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[8px] font-black uppercase text-slate-400">Marca</label>
                   <SelectOrInput options={['Western Digital', 'Seagate', 'Samsung', 'Kingston', 'Crucial', 'Toshiba', 'ADATA']} value={d.brand} onChange={(e:any) => { const n = [...formData.hw.disk]; n[idx].brand = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[8px] font-black uppercase text-slate-400">Capacidad</label>
                   <SelectOrInput options={['120GB', '240GB', '480GB', '500GB', '1TB', '2TB', '+']} value={d.capacity} onChange={(e:any) => { const n = [...formData.hw.disk]; n[idx].capacity = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[8px] font-black uppercase text-slate-400">Serial</label>
                   <input placeholder="Serial" value={d.serial} onChange={e => { const n = [...formData.hw.disk]; n[idx].serial = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[8px] font-black uppercase text-slate-400">Estado</label>
                   <SelectOrInput options={['Bueno', 'Funcional', 'Alerta', 'Falla']} value={d.status} onChange={(e:any) => { const n = [...formData.hw.disk]; n[idx].status = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                 </div>
                 <button type="button" onClick={() => { const n = formData.hw.disk.filter((_:any, i:any) => i !== idx); setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="p-2 text-red-500 font-bold">✕</button>
               </div>
               <input placeholder="Comentarios (opcional)" value={d.comments || ''} onChange={e => { const n = [...formData.hw.disk]; n[idx].comments = e.target.value; setFormData({...formData, hw: {...formData.hw, disk: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* Tarjeta de Video */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">🎮 Tarjeta de Video</h4>
            <button type="button" onClick={() => setFormData({...formData, hw: {...formData.hw, video: [...formData.hw.video, { type: 'Dedicada - NVIDIA', serial: '', status: 'Funcional', comments: '' }]}})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar Video</button>
          </div>
          {formData.hw.video.map((v: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-2">
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400">Tipo</label>
                  <SelectOrInput options={['Integrada', 'Dedicada - NVIDIA', 'Dedicada - AMD']} value={v.type} onChange={(e:any) => { const n = [...formData.hw.video]; n[idx].type = e.target.value; setFormData({...formData, hw: {...formData.hw, video: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400">Serial</label>
                  <input placeholder="Serial" value={v.serial} onChange={e => { const n = [...formData.hw.video]; n[idx].serial = e.target.value; setFormData({...formData, hw: {...formData.hw, video: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400">Estado</label>
                  <SelectOrInput options={['Funcional', 'Dañada']} value={v.status} onChange={(e:any) => { const n = [...formData.hw.video]; n[idx].status = e.target.value; setFormData({...formData, hw: {...formData.hw, video: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
                </div>
                <button type="button" onClick={() => { const n = formData.hw.video.filter((_:any, i:any) => i !== idx); setFormData({...formData, hw: {...formData.hw, video: n}})}} className="p-2 text-red-500 font-bold w-fit">✕</button>
              </div>
              <input placeholder="Comentarios (opcional)" value={v.comments || ''} onChange={e => { const n = [...formData.hw.video]; n[idx].comments = e.target.value; setFormData({...formData, hw: {...formData.hw, video: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* Puertos */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">🔌 Puertos</h4>
            <button type="button" onClick={() => setFormData({...formData, hw: {...formData.hw, ports: [...formData.hw.ports, { type: 'USB 3.0', quantity: '1', status: 'Funcional', comments: '' }]}})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar Puerto</button>
          </div>
          {formData.hw.ports.map((p: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-2">
                <SelectOrInput options={['USB 2.0', 'USB 3.0', 'USB-C', 'HDMI', 'DisplayPort', 'Ethernet/RJ45', 'Jack 3.5mm']} value={p.type} onChange={(e:any) => { const n = [...formData.hw.ports]; n[idx].type = e.target.value; setFormData({...formData, hw: {...formData.hw, ports: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <input type="number" placeholder="Cant." value={p.quantity} onChange={e => { const n = [...formData.hw.ports]; n[idx].quantity = e.target.value; setFormData({...formData, hw: {...formData.hw, ports: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <SelectOrInput options={['Funcional', 'Dañado', 'Sucio']} value={p.status} onChange={(e:any) => { const n = [...formData.hw.ports]; n[idx].status = e.target.value; setFormData({...formData, hw: {...formData.hw, ports: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <button type="button" onClick={() => { const n = formData.hw.ports.filter((_:any, i:any) => i !== idx); setFormData({...formData, hw: {...formData.hw, ports: n}})}} className="p-2 text-red-500 font-bold w-fit">✕</button>
              </div>
              <input placeholder="Comentarios (opcional)" value={p.comments || ''} onChange={e => { const n = [...formData.hw.ports]; n[idx].comments = e.target.value; setFormData({...formData, hw: {...formData.hw, ports: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* Monitores */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">🖥️ Monitor</h4>
            <button type="button" onClick={() => setFormData({...formData, hw: {...formData.hw, monitors: [...formData.hw.monitors, { model: '', serial: '', status: 'Funcional', comments: '' }]}})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar Monitor</button>
          </div>
          {formData.hw.monitors.map((m: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-2">
                <input placeholder="Modelo" value={m.model} onChange={e => { const n = [...formData.hw.monitors]; n[idx].model = e.target.value; setFormData({...formData, hw: {...formData.hw, monitors: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <input placeholder="Serial" value={m.serial} onChange={e => { const n = [...formData.hw.monitors]; n[idx].serial = e.target.value; setFormData({...formData, hw: {...formData.hw, monitors: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <SelectOrInput options={['Funcional', 'Dañado', 'Píxeles muertos']} value={m.status} onChange={(e:any) => { const n = [...formData.hw.monitors]; n[idx].status = e.target.value; setFormData({...formData, hw: {...formData.hw, monitors: n}})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <button type="button" onClick={() => { const n = formData.hw.monitors.filter((_:any, i:any) => i !== idx); setFormData({...formData, hw: {...formData.hw, monitors: n}})}} className="p-2 text-red-500 font-bold w-fit">✕</button>
              </div>
              <input placeholder="Comentarios (opcional)" value={m.comments || ''} onChange={e => { const n = [...formData.hw.monitors]; n[idx].comments = e.target.value; setFormData({...formData, hw: {...formData.hw, monitors: n}})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* UPS */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <h4 className="font-black text-slate-900 uppercase text-xs">🔋 UPS Asignado</h4>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Seleccionar UPS existente</label>
              <select 
                onChange={(e) => {
                  const selectedU = equipment.find(eq => eq.id === e.target.value);
                  if (selectedU) {
                    setFormData({...formData, ups: { brand: selectedU.brand, model: selectedU.model, serial: selectedU.serial, status: selectedU.status, comments: selectedU.description }});
                  }
                }}
                className="p-2 rounded-xl font-bold text-xs bg-white border border-slate-200"
              >
                <option value="">-- Buscar UPS en inventario --</option>
                {equipment.filter(e => e.type === 'UPS').map(u => (
                  <option key={u.id} value={u.id}>{u.brand} {u.model} ({u.serial})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectOrInput options={['APC', 'Tripp Lite', 'CyberPower', 'Forza', '+']} value={formData.ups.brand} onChange={(e:any) => setFormData({...formData, ups: {...formData.ups, brand: e.target.value}})} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
              <input placeholder="Modelo" value={formData.ups.model} onChange={e => setFormData({...formData, ups: {...formData.ups, model: e.target.value}})} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
              <input placeholder="Serie" value={formData.ups.serial} onChange={e => setFormData({...formData, ups: {...formData.ups, serial: e.target.value}})} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
              <SelectOrInput options={['Operativo', 'Batería agotada', 'Dañado']} value={formData.ups.status} onChange={(e:any) => setFormData({...formData, ups: {...formData.ups, status: e.target.value}})} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
            <input placeholder="Comentarios (opcional)" value={formData.ups.comments || ''} onChange={e => setFormData({...formData, ups: {...formData.ups, comments: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
          </div>
        </section>

        {/* Mantenimiento */}
        <section className="p-4 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-slate-900 uppercase text-xs">📅 Historial de Mantenimientos</h4>
            <button type="button" onClick={() => setFormData({...formData, maintenance: [...formData.maintenance, { type: 'Preventivo', date: new Date().toISOString(), comments: '' }]})} className="text-[10px] font-black text-blue-600 uppercase">+ Agregar Mantenimiento</button>
          </div>
          {formData.maintenance.map((m: any, idx: number) => (
            <div key={idx} className="pb-2 border-b border-slate-200 last:border-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-2">
                <SelectOrInput options={['Preventivo', 'Correctivo', 'Evolutivo']} value={m.type} onChange={(e:any) => { const n = [...formData.maintenance]; n[idx].type = e.target.value; setFormData({...formData, maintenance: n})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <input type="datetime-local" value={m.date.split('.')[0]} onChange={e => { const n = [...formData.maintenance]; n[idx].date = e.target.value; setFormData({...formData, maintenance: n})}} className="p-2 rounded-xl font-bold text-xs border border-slate-200" />
                <button type="button" onClick={() => { const n = formData.maintenance.filter((_:any, i:any) => i !== idx); setFormData({...formData, maintenance: n})}} className="p-2 text-red-500 font-bold w-fit">✕</button>
              </div>
              <input placeholder="Comentarios (opcional)" value={m.comments || ''} onChange={e => { const n = [...formData.maintenance]; n[idx].comments = e.target.value; setFormData({...formData, maintenance: n})}} className="w-full p-2 rounded-xl font-bold text-xs border border-slate-200" />
            </div>
          ))}
        </section>

        {/* Software y Red */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <section className="p-6 bg-slate-50 rounded-3xl space-y-4 flex flex-col">
              <h4 className="font-black text-slate-900 uppercase text-xs">💿 Software</h4>
              <div className="space-y-4 flex-grow">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Sistema Operativo</label>
                  <SelectOrInput options={['Windows 10 Pro', 'Windows 11 Pro', 'Windows 10 Home', 'Linux Ubuntu', 'Linux Debian', 'macOS']} value={formData.sw.os} onChange={(e:any) => setFormData({...formData, sw: {...formData.sw, os: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Arquitectura</label>
                  <SelectOrInput options={['64-bit', '32-bit']} value={formData.sw.arch} onChange={(e:any) => setFormData({...formData, sw: {...formData.sw, arch: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Comentarios (opcional)</label>
                  <input value={formData.sw.comments || ''} onChange={e => setFormData({...formData, sw: {...formData.sw, comments: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" placeholder="Ej. Antivirus instalado, Office 365, etc." />
                </div>
              </div>
           </section>

           <section className="p-6 bg-slate-50 rounded-3xl space-y-4">
              <h4 className="font-black text-slate-900 uppercase text-xs">🌐 Configuración de Red</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">IP</label>
                  <input value={formData.net.ip} onChange={e => setFormData({...formData, net: {...formData.net, ip: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Tipo</label>
                  <SelectOrInput options={['DHCP/Dinámica', 'Estática']} value={formData.net.type} onChange={(e:any) => setFormData({...formData, net: {...formData.net, type: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
                </div>
                <input placeholder="Máscara" value={formData.net.mask} onChange={e => setFormData({...formData, net: {...formData.net, mask: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
                <input placeholder="Puerta Enlace" value={formData.net.gateway} onChange={e => setFormData({...formData, net: {...formData.net, gateway: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-1 border border-slate-200" />
              </div>
              <input placeholder="Comentarios de red (opcional)" value={formData.net.comments || ''} onChange={e => setFormData({...formData, net: {...formData.net, comments: e.target.value}})} className="w-full p-2 rounded-xl font-bold text-xs mt-2 border border-slate-200" />
           </section>
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Guardar PC Completa
        </button>
      </form>
    );
  };

  const ComponentForm = () => {
    const [formData, setFormData] = useState<any>(() => {
      if (editingEquipment && editingEquipment.type !== 'PC') {
        const hw = editingEquipment.hw_data || {};
        return {
          responsible: editingEquipment.responsible || '',
          brand: editingEquipment.brand || '',
          model: editingEquipment.model || '',
          serial: editingEquipment.serial || '',
          type_printing: hw.type_printing || '',
          connectivity: hw.connectivity || '',
          page_counter: hw.page_counter || '',
          capacity: hw.capacity || '',
          status: editingEquipment.status || 'Operativa',
          description: editingEquipment.description || '',
          length: hw.length || '',
          assigned_to: hw.assigned_to || ''
        };
      }
      return {
        responsible: '',
        brand: '',
        model: '',
        serial: '',
        type_printing: '',
        connectivity: '',
        page_counter: '',
        capacity: '',
        status: 'Operativa',
        description: '',
        length: '',
        assigned_to: ''
      };
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const payload = {
        company_id: selectedCompany?.id,
        section_id: selectedSection,
        type: compType,
        responsible: formData.responsible,
        brand: formData.brand,
        model: formData.model,
        serial: formData.serial,
        status: formData.status,
        hw_data: {
          type_printing: formData.type_printing,
          connectivity: formData.connectivity,
          page_counter: formData.page_counter,
          capacity: formData.capacity,
          length: formData.length,
          assigned_to: formData.assigned_to
        },
        description: formData.description
      };

      let error;
      if (editingEquipment) {
        (payload.hw_data as any).last_updated_at = new Date().toISOString();
        const res = await supabase.from('it_equipment').update(payload).eq('id', editingEquipment.id);
        error = res.error;
      } else {
        const res = await supabase.from('it_equipment').insert([payload]);
        error = res.error;
      }

      if (!error) {
        setEditingEquipment(null);
        setView('company_details');
        if (selectedCompany) fetchCompanyData(selectedCompany);
        if (view === 'all_inventory') fetchAllEquipment();
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl shadow-xl max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-black text-slate-900 uppercase">{editingEquipment ? `Editar ${compType}` : `Agregar ${compType}`}</h2>
          <button type="button" onClick={() => { setEditingEquipment(null); setView('company_details'); }} className="text-slate-400">Cerrar</button>
        </div>

        <select 
          required
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full bg-slate-50 p-4 rounded-xl font-bold"
        >
          <option value="">Seleccionar Departamento...</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <input placeholder="Responsable" required value={formData.responsible} onChange={e => setFormData({...formData, responsible: e.target.value})} className="w-full border p-4 rounded-xl font-bold" />
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Marca" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="border p-4 rounded-xl font-bold" />
          <input placeholder="Modelo" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="border p-4 rounded-xl font-bold" />
        </div>
        <input placeholder="Serial" value={formData.serial} onChange={e => setFormData({...formData, serial: e.target.value})} className="w-full border p-4 rounded-xl font-bold" />

        {compType === 'Impresora' && (
          <div className="grid grid-cols-2 gap-4">
            <select value={formData.type_printing} onChange={e => setFormData({...formData, type_printing: e.target.value})} className="border p-4 rounded-xl font-bold">
              <option value="">Tipo Impresión</option>
              {['Inyección de tinta', 'Láser', 'Térmica'].map(o => <option key={o}>{o}</option>)}
            </select>
            <input placeholder="Conectividad (USB, Wi-Fi)" value={formData.connectivity} onChange={e => setFormData({...formData, connectivity: e.target.value})} className="border p-4 rounded-xl font-bold" />
          </div>
        )}

        {compType === 'UPS' && (
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Capacidad (VA/Watts)" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className="border p-4 rounded-xl font-bold" />
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="border p-4 rounded-xl font-bold">
              {['Operativa', 'Nueva', 'Requiere cambio'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}

        {compType === 'Cable/Adaptador' && (
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Longitud (metros)" value={formData.length} onChange={e => setFormData({...formData, length: e.target.value})} className="border p-4 rounded-xl font-bold" />
            <input placeholder="Asignado a (Puesto)" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="border p-4 rounded-xl font-bold" />
          </div>
        )}

        <textarea placeholder="Observaciones" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-4 rounded-xl font-bold h-32" />

        <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold uppercase">Guardar Componente</button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Herramientas TI</h1>
            <p className="text-slate-400 font-bold text-sm">Gestión de inventario informático y activos de red</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {view === 'companies' && (
              <>
                <button 
                  onClick={() => { setView('all_inventory'); fetchAllEquipment(); }}
                  className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2"
                >
                  <span>📋</span> Inventario Global
                </button>
                <button 
                  onClick={() => setShowAddCompanyModal(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 flex items-center gap-2"
                >
                  <span>➕</span> Empresa
                </button>
              </>
            )}
            {view === 'all_inventory' && (
               <button onClick={() => setView('companies')} className="bg-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase">Volver a Empresas</button>
            )}
            {view === 'company_details' && (
               <>
                 <button onClick={() => setView('companies')} className="bg-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase">Volver</button>
                 <button onClick={() => setShowAddSectionModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase">Nueva Sección</button>
               </>
            )}
          </div>
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold animate-pulse uppercase text-xs tracking-widest">Sincronizando Inventario...</p>
          </div>
        )}

        {view === 'companies' && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map(company => (
              <motion.div 
                layoutId={company.id}
                key={company.id} 
                className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100 hover:shadow-2xl hover:scale-[1.02] transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full translate-x-16 -translate-y-16 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform">🏢</div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditingCompany(company.id); setEditingCompanyName(company.name); }} className="text-slate-400 hover:text-blue-600">✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id); }} className="text-slate-400 hover:text-red-600">🗑️</button>
                    </div>
                  </div>
                  {editingCompany === company.id ? (
                      <div className="flex gap-2 mb-2">
                          <input value={editingCompanyName} onChange={e => setEditingCompanyName(e.target.value)} className="w-full text-xl font-black text-slate-800 uppercase border-b-2 border-blue-600" autoFocus />
                          <button onClick={(e) => { e.stopPropagation(); handleUpdateCompany(company.id, editingCompanyName); }} className="text-emerald-600 font-bold">✓</button>
                      </div>
                  ) : (
                    <h3 onClick={() => { setSelectedCompany(company); setView('company_details'); fetchCompanyData(company); }} className="text-xl font-black text-slate-800 uppercase mb-2 cursor-pointer">{company.name}</h3>
                  )}
                  <div onClick={() => { setSelectedCompany(company); setView('company_details'); fetchCompanyData(company); }} className="flex items-center gap-2 text-slate-400 font-bold text-[10px] tracking-widest uppercase cursor-pointer">
                    <span>Gestionar Equipos</span>
                    <span className="group-hover:translate-x-2 transition-transform">→</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {view === 'all_inventory' && !loading && (
          <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
               <div className="flex items-center gap-4">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Inventario Consolidado</h3>
                 <span className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-xs font-black uppercase">{allEquipment.filter(e => filterType === 'Todos' || e.type === filterType).length} Total</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtrar:</span>
                 <select 
                   value={filterType} 
                   onChange={e => setFilterType(e.target.value)} 
                   className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs uppercase cursor-pointer"
                 >
                   <option value="Todos">Todos</option>
                   {Array.from(new Set(allEquipment.map(e => e.type))).map(t => (
                     <option key={t} value={t}>{t}</option>
                   ))}
                 </select>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                     <th className="px-8 py-4">Equipo</th>
                     <th className="px-8 py-4">Tipo</th>
                     <th className="px-8 py-4">Responsable</th>
                     <th className="px-8 py-4">Serial</th>
                     <th className="px-8 py-4">Estado</th>
                     <th className="px-8 py-4">Acciones</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {allEquipment.filter(e => filterType === 'Todos' || e.type === filterType).map(item => (
                     <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-8 py-4 font-bold text-slate-700">{item.brand} {item.model}</td>
                       <td className="px-8 py-4">
                         <span className="text-[10px] font-black uppercase text-blue-600 px-2 py-0.5 bg-blue-50 rounded-full">{item.type}</span>
                       </td>
                       <td className="px-8 py-4 font-bold text-slate-500 text-xs">{item.responsible}</td>
                       <td className="px-8 py-4 font-mono text-[10px] text-slate-400">{item.serial || 'N/A'}</td>
                       <td className="px-8 py-4">
                         <span className={`text-[10px] font-black uppercase ${item.status.includes('Funcional') || item.status.includes('Operativo') ? 'text-green-500' : 'text-red-500'}`}>{item.status}</span>
                       </td>
                       <td className="px-8 py-4 flex gap-2">
                          <button onClick={() => downloadPDF(item.id)} className="p-2 hover:bg-white rounded-lg transition-all" title="Descargar PDF">📄</button>
                          <button onClick={() => startEditing(item)} className="p-2 hover:bg-white rounded-lg transition-all text-blue-600" title="Editar">✏️</button>
                          <button onClick={() => deleteEquipment(item.id)} className="p-2 hover:bg-white rounded-lg transition-all text-red-500" title="Eliminar">✕</button>
                       </td>
                     </tr>
                   ))}
                   {allEquipment.length === 0 && (
                     <tr>
                       <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">No hay datos para mostrar</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {view === 'company_details' && !loading && (
          <div className="space-y-12">
             <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
                <h2 className="text-3xl font-black uppercase mb-1">{selectedCompany?.name}</h2>
                <p className="text-blue-400 font-bold text-xs uppercase tracking-widest">Dashboard de Activos Tecnológicos</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
                   <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                     <p className="text-[10px] font-black uppercase text-blue-300 mb-1">Total Equipos</p>
                     <p className="text-3xl font-black">{equipment.length}</p>
                   </div>
                   <button onClick={() => setView('manage_sections')} className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 hover:bg-white/20 transition-all text-left">
                     <p className="text-[10px] font-black uppercase text-blue-300 mb-1">Departamentos</p>
                     <p className="text-3xl font-black text-white">{sections.length}</p>
                   </button>
                   <button 
                     onClick={() => setView('diagram')} 
                     className="bg-indigo-600 rounded-3xl p-6 hover:bg-indigo-700 transition-all text-left group"
                   >
                     <p className="text-[10px] font-black uppercase text-white/60 mb-1">Topología</p>
                     <p className="text-xl font-black uppercase text-white">Diagrama 🕸️</p>
                   </button>
                   <button 
                     onClick={() => setView('form_pc')}
                     className="bg-blue-600 rounded-3xl p-6 hover:bg-blue-700 transition-all text-left group"
                   >
                     <p className="text-[10px] font-black uppercase text-white/60 mb-1">Acción Rápida</p>
                     <p className="text-xl font-black uppercase text-white">Agregar PC 💻</p>
                   </button>
                   <select 
                     onChange={(e) => { 
                       if(e.target.value) { 
                         setCompType(e.target.value); 
                         setView('form_component'); 
                       }
                     }} 
                     className="bg-white text-slate-900 rounded-3xl p-6 font-black uppercase text-sm appearance-none cursor-pointer"
                   >
                     <option value="">➕ Otro Equipo</option>
                     {['Impresora', 'UPS', 'Periférico', 'Cable/Adaptador', 'Otros'].map(o => <option key={o} value={o}>{o}</option>)}
                   </select>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 px-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Inventario Registrado</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtrar:</span>
                    <select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)} 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs uppercase cursor-pointer"
                    >
                      <option value="Todos">Todos</option>
                      {Array.from(new Set(equipment.map(e => e.type))).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {equipment.filter(e => filterType === 'Todos' || e.type === filterType).map(item => (
                     <motion.div 
                       id={`equip-card-${item.id}`}
                       key={item.id} 
                       className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-100 flex flex-col justify-between border-2 border-transparent hover:border-blue-600 transition-all group"
                     >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                              {item.type}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-lg font-black text-slate-900 uppercase line-clamp-1">{item.brand} {item.model || item.type}</h4>
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-tight mb-4">S/N: {item.serial || 'N/A'}</p>
                          
                          <div className="space-y-2 mb-6">
                             <div className="flex items-center gap-2">
                               <span className="text-sm">👤</span>
                               <span className="text-xs font-bold text-slate-600 truncate">{item.responsible}</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-sm">📍</span>
                               <span className="text-xs font-bold text-slate-600 truncate">
                                 {sections.find(s => s.id === item.section_id)?.name || 'Sin asignar'}
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-sm">⚡</span>
                               <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                 item.status.toLowerCase().includes('funcional') || item.status.toLowerCase().includes('operativa') 
                                 ? 'bg-green-50 text-green-600' 
                                 : 'bg-red-50 text-red-600'
                               }`}>
                                 {item.status}
                               </span>
                             </div>
                          </div>
                        </div>

                        <div className="flex gap-2 border-t border-slate-50 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => downloadPDF(item.id)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition">PDF</button>
                           <button onClick={() => startEditing(item)} className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition">Editar</button>
                           <button onClick={() => deleteEquipment(item.id)} className="w-12 bg-red-50 font-bold text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all">✕</button>
                        </div>
                     </motion.div>
                   ))}
                   {equipment.length === 0 && (
                     <div className="col-span-full py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4">
                        <span className="text-6xl">📦</span>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay equipos registrados aún</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {view === 'form_pc' && <PCForm />}
        {view === 'form_component' && <ComponentForm />}

        {view === 'manage_sections' && selectedCompany && (
          <div className="bg-white rounded-3xl p-8 shadow-xl max-w-4xl mx-auto mt-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase">Departamentos</h2>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">{selectedCompany.name}</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowAddSectionModal(true)} 
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition"
                >
                  Nuevo Depto
                </button>
                <button 
                  onClick={() => setView('company_details')} 
                  className="bg-slate-200 text-slate-900 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {sections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map(section => (
                  <div key={section.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center justify-between group">
                    <div className="flex-1 mr-4">
                      <input 
                        type="text" 
                        defaultValue={section.name}
                        onBlur={(e) => {
                          if (e.target.value !== section.name) {
                            handleUpdateSection(section.id, e.target.value);
                          }
                        }}
                        className="w-full bg-transparent font-bold text-slate-900 focus:outline-none focus:border-b-2 focus:border-blue-600 transition-all uppercase text-sm"
                        placeholder="Nombre del departamento"
                      />
                    </div>
                    <button 
                      onClick={() => handleDeleteSection(section.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      title="Eliminar departamento"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <span className="text-6xl text-slate-200 block mb-4">🏢</span>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay departamentos agregados</p>
              </div>
            )}
          </div>
        )}

        {view === 'diagram' && selectedCompany && (
          <NetworkDiagram 
            company={selectedCompany} 
            equipment={equipment} 
            sections={sections}
            onEditEquipment={startEditing} 
            onClose={() => setView('company_details')} 
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddCompanyModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black text-slate-900 uppercase mb-2">Nueva Empresa</h2>
              <p className="text-slate-400 font-semibold text-sm mb-6 uppercase tracking-tight">Registro de entidad organizativa</p>
              <input 
                autoFocus
                type="text" 
                placeholder="Nombre de la empresa"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all mb-6"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateCompany}
                  className="flex-1 bg-blue-600 text-white rounded-2xl py-4 font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  Crear
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddSectionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black text-slate-900 uppercase mb-2">Nuevo Departamento</h2>
              <p className="text-slate-400 font-semibold text-sm mb-6 uppercase tracking-tight">En {selectedCompany?.name}</p>
              <input 
                autoFocus
                type="text" 
                placeholder="Nombre de la sección"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all mb-6"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowAddSectionModal(false)}
                  className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateSection}
                  className="flex-1 bg-blue-600 text-white rounded-2xl py-4 font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  Crear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .pdf-rendering { padding: 20mm !important; background: white !important; }
      `}</style>
    </div>
  );
};

export default ITTools;
