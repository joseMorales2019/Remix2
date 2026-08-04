import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Panel,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  SelectionMode,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  reconnectEdge,
  ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../supabase';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import {
  MonitorSmartphone,
  Printer,
  Server,
  Laptop,
  Cpu,
  Router,
  Shield,
  Wifi,
  Webcam,
  HardDrive,
  Save,
  Download,
  FileJson,
  MousePointer2,
  Hand,
  Trash2,
  Network,
  Maximize,
  Minimize,
  Pencil
} from 'lucide-react';

const DEVICE_TYPES: Record<string, any> = {
  'Router': Router,
  'Switch L2': Network,
  'Switch L3': Network,
  'Servidor': Server,
  'Firewall': Shield,
  'Access Point': Wifi,
  'PC': MonitorSmartphone,
  'Laptop': Laptop,
  'Impresora': Printer,
  'Cámara IP': Webcam,
  'Storage': HardDrive,
  'Otros': Cpu
};

export const DiagramConfigContext = React.createContext({
  showIcon: true,
  showType: true,
  showStatus: true,
  showName: true,
  showIp: true,
  showResponsible: false,
  showBrandModel: false,
  showSerial: false,
  showMac: false,
  showSection: false,
  showSubnetMask: false,
  showGateway: false,
  showOs: false,
  edgeRadius: 20,
  highlightSectionId: null as string | null,
  equipmentSections: {} as Record<string, string>,
  sectionsMap: {} as Record<string, string>,
  sections: [] as any[],
  equipment: [] as any[]
});

export const DiagramActionContext = React.createContext<any>({});

// Waypoint Node component
const WaypointNode = ({ id, selected }: any) => {
  const actions = React.useContext(DiagramActionContext);
  return (
    <div 
      onDoubleClick={(e) => { e.stopPropagation(); actions?.onDeleteWaypoint(id); }}
      title="Doble clic: Borrar | Arrastrar: Mover segmento"
      className={`w-5 h-5 bg-blue-500 rounded-full border-2 border-slate-950 shadow-lg flex items-center justify-center transition-all cursor-move z-50 ${selected ? 'scale-125 ring-4 ring-blue-500/40' : 'hover:scale-110 hover:bg-blue-400'}`}
    >
      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" id="l" />
      <Handle type="source" position={Position.Right} className="opacity-0" id="r" />
    </div>
  );
};

// Inline editable field component
const InlineEditable = ({ value, onUpdate, className, field }: { value: string, onUpdate: (val: string) => void, className: string, field: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    
    if (isEditing) {
        return (
            <input
                className={`${className} bg-slate-800 border border-slate-600 rounded px-1 outline-none`}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={() => { setIsEditing(false); onUpdate(tempValue); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditing(false); onUpdate(tempValue); } }}
                autoFocus
            />
        );
    }
    return (
        <span className={`${className} group flex items-center cursor-pointer`} onClick={() => setIsEditing(true)}>
            {value || <span className="text-slate-600 italic">...</span>}
            <Pencil size={10} className="ml-1 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
        </span>
    );
};

// Editable Dropdown component
const EditableDropdown = ({ field, value, sections, onUpdate, className }: { field: string, value: string, sections: any[], onUpdate: (val: string) => void, className: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const sectionName = sections?.find(s => s.id === value)?.name || 'Sin Sección';
    
    if (isEditing) {
        return (
            <select 
                value={value || ''} 
                onChange={(e) => { setIsEditing(false); onUpdate(e.target.value); }}
                onBlur={() => setIsEditing(false)}
                className="bg-slate-800 text-emerald-400 rounded px-1 cursor-pointer"
                autoFocus
            >
                <option value="">Sin Sección</option>
                {sections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        );
    }
    return (
        <span className={`${className} group flex items-center cursor-pointer`} onClick={() => setIsEditing(true)}>
            {sectionName}
            <Pencil size={10} className="ml-1 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
        </span>
    );
};

// Custom Node component
const CustomDeviceNode = ({ id, data, selected }: any) => {
  const config = React.useContext(DiagramConfigContext);
  const actions = React.useContext(DiagramActionContext);
  const Icon = DEVICE_TYPES[data.type] || Cpu;
  const isOnline = data.status && (data.status.includes('Funcional') || data.status.includes('Operativo') || data.status.includes('Bueno'));
  const statusColor = isOnline ? 'bg-green-500' : 'bg-red-500';
  
  const sectionId = data.section_id || config.equipmentSections[data.inventoryId];
  const isHighlighted = config.highlightSectionId && sectionId === config.highlightSectionId;
  const borderClass = selected ? 'border-blue-500 shadow-blue-500/20 z-10' : isHighlighted ? 'border-amber-400 shadow-amber-500/40 ring-2 ring-amber-400 z-10' : 'border-slate-700 opacity-90';
  
  // Fallback lookup if fields are missing in data
  const inventoryItem = data.inventoryId ? config.equipment.find(e => e.id === data.inventoryId) : null;
  const subnetMask = data.subnetMask || (inventoryItem?.net_data?.mask || '');
  const gateway = data.gateway || (inventoryItem?.net_data?.gateway || '');
  const os = data.os || (inventoryItem?.sw_data?.os || '');
  
  const handleUpdate = (field: string, val: string) => {
      if (data.inventoryId) {
          let update: any = {};
          if (field === 'hostname') update = { name: val };
          else if (['ip', 'subnetMask', 'gateway'].includes(field)) {
             const mapping = { ip: 'ip', subnetMask: 'mask', gateway: 'gateway' };
             update = { net_data: { ...(inventoryItem?.net_data || {}), [(mapping as any)[field]]: val } };
          }
          else if (field === 'os') {
             update = { sw_data: { ...(inventoryItem?.sw_data || {}), os: val } };
          }
          else if (['brand', 'model', 'responsible', 'serial', 'mac', 'section_id'].includes(field)) {
             update = { [field]: val };
          }
          else update = { [field]: val };
          
          actions?.updateEquipment(data.inventoryId, update);
          
          // Update Node Data locally
          actions?.setNodes((nds: any[]) => 
            nds.map(node => node.id === id ? { ...node, data: { ...node.data, [field]: val } } : node)
          );
      }
  };

  return (
    <div className={`bg-slate-900 border-2 rounded-xl p-3 text-white w-48 shadow-xl transition-all ${borderClass} ${config.highlightSectionId && !isHighlighted ? 'opacity-30 grayscale' : ''}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
      
      {(config.showIcon || config.showType || config.showStatus) && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {config.showIcon && <Icon className="w-5 h-5 text-blue-400" />}
            {config.showType && <span className="text-[10px] uppercase font-black tracking-widest text-blue-400">{data.type}</span>}
          </div>
          {config.showStatus && <div className={`w-2 h-2 rounded-full ${statusColor}`} title={data.status} />}
        </div>
      )}
      
      {(config.showName || config.showIp || config.showResponsible || config.showBrandModel || config.showSerial || config.showMac || config.showSection) && (
        <div className="space-y-1">
          {config.showName && <InlineEditable field="hostname" value={data.hostname || data.name} className="font-bold text-sm truncate block" onUpdate={(val) => handleUpdate('hostname', val)} />}
          {config.showBrandModel && (data.brand || data.model) && <p className="text-[10px] text-slate-400 truncate">
             <InlineEditable field="brand" value={data.brand || ''} className="inline" onUpdate={(val) => handleUpdate('brand', val)} />, 
             <InlineEditable field="model" value={data.model || ''} className="inline ml-1" onUpdate={(val) => handleUpdate('model', val)} />
          </p>}
          {config.showSection && (
             <p className="text-[10px] font-bold text-emerald-400 truncate flex items-center">
                🏢 
                <EditableDropdown field="section_id" value={sectionId || ''} sections={config.sections} className="ml-1" onUpdate={(val) => handleUpdate('section_id', val)} />
             </p>
          )}
          {config.showResponsible && <p className="text-[10px] font-bold text-blue-300 truncate">👤 <InlineEditable field="responsible" value={data.responsible || ''} className="inline" onUpdate={(val) => handleUpdate('responsible', val)} /></p>}
          {config.showIp && <InlineEditable field="ip" value={data.ip || ''} className="font-mono text-[10px] text-slate-400 block" onUpdate={(val) => handleUpdate('ip', val)} />}
          {config.showSubnetMask && <p className="font-mono text-[9px] text-slate-500">Máscara: <InlineEditable field="subnetMask" value={subnetMask} className="" onUpdate={(val) => handleUpdate('subnetMask', val)} /></p>}
          {config.showGateway && <p className="font-mono text-[9px] text-slate-500">Gateway: <InlineEditable field="gateway" value={gateway} className="" onUpdate={(val) => handleUpdate('gateway', val)} /></p>}
          {config.showOs && <p className="font-mono text-[9px] text-slate-500">OS: <InlineEditable field="os" value={os} className="" onUpdate={(val) => handleUpdate('os', val)} /></p>}
          {config.showMac && data.mac && <p className="font-mono text-[9px] text-slate-500">MAC: <InlineEditable field="mac" value={data.mac || ''} className="" onUpdate={(val) => handleUpdate('mac', val)} /></p>}
          {config.showSerial && data.serial && <p className="font-mono text-[9px] text-slate-500">SN: <InlineEditable field="serial" value={data.serial || ''} className="" onUpdate={(val) => handleUpdate('serial', val)} /></p>}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
      <Handle type="source" position={Position.Left} id="left" className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
      <Handle type="target" position={Position.Right} id="right" className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </div>
  );
};

// Custom Edge component for splitting
const CustomCableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected
}: any) => {
  const actions = React.useContext(DiagramActionContext);
  const config = React.useContext(DiagramConfigContext);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: config.edgeRadius || 0 // Set to 0 if 90 degrees are preferred, or configurable
  });

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={style} 
        id={id} 
        interactionWidth={20}
      />
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-xl"
          >
            <button 
              className="text-[10px] uppercase font-black tracking-widest text-white hover:text-blue-400 px-2 py-1 bg-slate-900 rounded" 
              onClick={(e) => { e.stopPropagation(); actions?.onSplitEdge(id, labelX, labelY); }}
              title="Agregar punto de quiebre (Punto de corte)"
            >
              + Punto
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = {
  customDevice: CustomDeviceNode,
  waypoint: WaypointNode,
};

const edgeTypes = {
  customCable: CustomCableEdge,
};

const CABLE_TYPES = [
  { id: 'utp', name: 'UTP Cat5e/6', color: '#3b82f6', animated: false, dash: false },
  { id: 'fiber', name: 'Fibra Óptica', color: '#f59e0b', animated: true, dash: false },
  { id: 'wifi', name: 'WiFi', color: '#10b981', animated: true, dash: true },
  { id: 'serial', name: 'Serial/Consola', color: '#ef4444', animated: false, dash: true },
  { id: 'poe', name: 'PoE', color: '#8b5cf6', animated: false, dash: false }
];

export default function NetworkDiagram({ company, equipment, sections = [], onEditEquipment, onClose }: { company: any, equipment: any[], sections?: any[], onEditEquipment: (equip: any) => void, onClose: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  const [selectedCableType, setSelectedCableType] = useState(CABLE_TYPES[0]);
  const [isSaving, setIsSaving] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  
  const updateEquipment = useCallback(async (id: string, updates: any) => {
      const { error } = await supabase.from('equipment').update(updates).eq('id', id);
      if (error) console.error("Error updating equipment:", error);
      else {
          // Manually update local equipment list if necessary or refresh
          // For simplicity, just log for now, the user may need a page refresh or we need a better state management
          console.log("Equipment updated successfully");
      }
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [nodeConfig, setNodeConfig] = useState({
    showIcon: true,
    showType: true,
    showStatus: true,
    showName: true,
    showIp: true,
    showResponsible: false,
    showBrandModel: false,
    showSerial: false,
    showMac: false,
    showSection: false,
    showSubnetMask: false,
    showGateway: false,
    showOs: false,
    edgeRadius: 20
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      diagramRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load Diagram
  useEffect(() => {
    if (company && company.diagram_data) {
      if (company.diagram_data.nodes) setNodes(company.diagram_data.nodes);
      if (company.diagram_data.edges) {
        // Migrate old smoothstep edges to the custom splittable cable
        const migratedEdges = company.diagram_data.edges.map((e: any) => 
          e.type === 'smoothstep' ? { ...e, type: 'customCable' } : e
        );
        setEdges(migratedEdges);
      }
      if (company.diagram_data.config) setNodeConfig({...nodeConfig, ...company.diagram_data.config});
    }
  }, [company]);

  // Handle auto-save with debounce
  const timeoutRef = useRef<any>(null);
  const saveDiagram = useCallback(async (currentNodes: Node[], currentEdges: Edge[], currentConfig: any) => {
    if (!company) return;
    setIsSaving(true);
    const diagram_data = { nodes: currentNodes, edges: currentEdges, config: currentConfig };
    company.diagram_data = diagram_data; // update local pointer so it persists across renders
    
    // We update the DB
    const { error } = await supabase.from('it_companies').update({ diagram_data }).eq('id', company.id);
    if (error) console.error("Error saving diagram:", error);
    
    setTimeout(() => setIsSaving(false), 500); // UI feedback delay
  }, [company]);

  const triggerAutoSave = useCallback((updatedNodes: Node[], updatedEdges: Edge[], updatedConfig: any = nodeConfig) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveDiagram(updatedNodes, updatedEdges, updatedConfig);
    }, 1500);
  }, [saveDiagram, nodeConfig]);

  const onDeleteWaypoint = useCallback((waypointId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== waypointId));
    setEdges((eds) => {
      const incoming = eds.find((e) => e.target === waypointId);
      const outgoing = eds.find((e) => e.source === waypointId);

      if (incoming && outgoing) {
        const newEdge = {
          ...incoming,
          id: `edge_${Date.now()}`,
          target: outgoing.target,
          targetHandle: outgoing.targetHandle,
        };
        const next = [...eds.filter((e) => e.target !== waypointId && e.source !== waypointId), newEdge];
        triggerAutoSave(nodes.filter(n => n.id !== waypointId), next, nodeConfig);
        return next;
      }
      
      const next = eds.filter((e) => e.target !== waypointId && e.source !== waypointId);
      triggerAutoSave(nodes.filter(n => n.id !== waypointId), next, nodeConfig);
      return next;
    });
  }, [nodes, setNodes, setEdges, triggerAutoSave, nodeConfig]);

  const onSplitEdge = useCallback((edgeId: string, x: number, y: number) => {
    const waypointId = `wp_${Date.now()}`;
    const wpNode = {
      id: waypointId,
      type: 'waypoint',
      draggable: true,
      position: { x, y },
      data: {}
    };

    setNodes((nds) => [...nds, wpNode]);
    setEdges((eds) => {
      const currentEdge = eds.find(e => e.id === edgeId);
      if(!currentEdge) return eds;
      
      const edge1 = {
        ...currentEdge,
        id: `${edgeId}_1`,
        target: waypointId,
        targetHandle: null,
      };
      
      const edge2 = {
        ...currentEdge,
        id: `${edgeId}_2`,
        source: waypointId,
        sourceHandle: null,
      };
      
      const next = [...eds.filter(e => e.id !== edgeId), edge1, edge2];
      triggerAutoSave([...nodes, wpNode], next, nodeConfig);
      return next;
    });
  }, [nodes, setNodes, setEdges, triggerAutoSave, nodeConfig]);

  const onEdgeDoubleClick = useCallback((evt: any, edge: Edge) => {
    // Instead of deleting, we split on double click as requested ("punto de corte")
    // Get mouse position relative to the pane if possible, but edge double click event is generic.
    // We use the edge's center for simplicity in double-click
    const edgeElement = document.querySelector(`[data-edgeid="${edge.id}"] path.react-flow__edge-path`) as SVGGeometryElement;
    if (edgeElement) {
        const point = edgeElement.getPointAtLength(edgeElement.getTotalLength() / 2);
        onSplitEdge(edge.id, point.x, point.y);
    }
  }, [onSplitEdge]);

  const onEdgeContextMenu = useCallback((event: any, edge: Edge) => {
    event.preventDefault();
    if (!reactFlowInstance) return;
    
    // Get exact flow position of the click
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    onSplitEdge(edge.id, position.x, position.y);
  }, [reactFlowInstance, onSplitEdge]);

  // On nodes change
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        // If it's a structural change, trigger save
        if (changes.some(c => c.type === 'position' && !c.dragging)) {
           triggerAutoSave(next, edges);
        }
        return next;
      });
    },
    [setNodes, edges]
  );

  // On edges change
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        triggerAutoSave(nodes, next);
        return next;
      });
    },
    [setEdges, nodes]
  );

  // On connect
  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const newEdge = {
        ...params,
        type: 'customCable',
        animated: selectedCableType.animated,
        style: { stroke: selectedCableType.color, strokeWidth: 2, strokeDasharray: selectedCableType.dash ? '5,5' : 'none' },
        markerEnd: { type: MarkerType.ArrowClosed, color: selectedCableType.color }
      };
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        triggerAutoSave(nodes, next);
        return next;
      });
    },
    [setEdges, selectedCableType, nodes, triggerAutoSave]
  );
  
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => {
        const next = reconnectEdge(oldEdge, newConnection, eds);
        triggerAutoSave(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, triggerAutoSave]
  );
  
  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const equipId = event.dataTransfer.getData('application/reactflow-id');
      const invEquip = equipment.find(e => e.id === equipId);
      
      let nodeData = {};
      let typeLabel = '';

      if (invEquip) {
        typeLabel = invEquip.type;
        nodeData = {
          type: typeLabel,
          name: `${invEquip.brand || ''} ${invEquip.model || ''}`.trim(),
          hostname: invEquip.net_data?.ip || invEquip.serial || 'Sin IP',
          status: invEquip.status,
          ip: invEquip.net_data?.ip || '',
          inventoryId: invEquip.id,
          section_id: invEquip.section_id,
          responsible: invEquip.responsible,
          brand: invEquip.brand,
          model: invEquip.model,
          serial: invEquip.serial,
          mac: invEquip.net_data?.mac || '',
          subnetMask: invEquip.net_data?.mask || '',
          gateway: invEquip.net_data?.gateway || '',
          os: invEquip.sw_data?.os || ''
        };
      } else {
        typeLabel = event.dataTransfer.getData('application/reactflow-type');
        if (!typeLabel) return;
        nodeData = {
          type: typeLabel,
          name: `Nuevo ${typeLabel}`,
          hostname: '',
          status: 'Bueno',
          ip: '0.0.0.0',
        };
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node_${Date.now()}`,
        type: 'customDevice',
        position,
        data: nodeData,
      };

      setNodes((nds) => {
        const next = nds.concat(newNode);
        triggerAutoSave(next, edges);
        return next;
      });
    },
    [reactFlowInstance, equipment, nodes, edges]
  );

  const onNodeDoubleClick = (e: any, node: Node) => {
    if (node.data.inventoryId) {
      const invEquip = equipment.find(eq => eq.id === node.data.inventoryId);
      if (invEquip) onEditEquipment(invEquip);
    } else {
      alert("Este dispositivo no está vinculado al inventario. Añádelo al inventario primero.");
      // Ideally here we could open the edit form to create a new one, but to keep it simple:
    }
  };

  const onDragStartSidebar = (event: any, type: string, id?: string) => {
    if (id) {
      event.dataTransfer.setData('application/reactflow-id', id);
    } else {
      event.dataTransfer.setData('application/reactflow-type', type);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const exportAsPNG = useCallback(() => {
    if (reactFlowInstance) {
      const nodesBounds = reactFlowInstance.getNodes(); // Note: getting bounds is more complex, but we capture the viewport
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (viewport) {
        toPng(viewport, { backgroundColor: '#0f172a' }).then((dataUrl) => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `Topologia_${company.name}.png`;
          a.click();
        });
      }
    }
  }, [reactFlowInstance, company]);

  const exportAsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Topologia_${company.name}.json`;
    a.click();
  };

  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected));
      // Force save after deletion
      triggerAutoSave(nodes.filter((n) => !n.selected), edges.filter((e) => !e.selected));
    }
  }, [nodes, edges]);

  // Hook delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Warning: this could trigger when typing in inputs. 
        // Need to check active element.
        if (document.activeElement?.tagName === 'BODY' || document.activeElement?.className.includes('react-flow')) {
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);


  return (
    <div ref={diagramRef} className={`w-full flex flex-col md:flex-row bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative ${isFullscreen ? 'h-screen' : 'h-[80vh]'}`}>
      
      {/* Top Navbar overlay for diagram */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center bg-slate-900/80 backdrop-blur border border-slate-700/50 p-3 rounded-2xl" style={{ width: '500px', height: '75px' }}>
        <div className="flex items-center gap-4">
           <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all">
             Volver
           </button>
           <h3 className="text-white font-black uppercase tracking-widest text-sm hidden sm:block">Topología: {company?.name}</h3>
        </div>
        <div className="flex items-center gap-2">
           <span className={`text-[10px] font-bold uppercase tracking-widest mr-2 ${isSaving ? 'text-blue-400' : 'text-slate-500'}`}>
             {isSaving ? 'Guardando...' : 'Guardado'}
           </span>
           <button onClick={() => setShowPanels(!showPanels)} className={`p-2 rounded-xl text-white transition-all ${!showPanels ? 'bg-blue-600' : 'bg-slate-800 hover:bg-blue-600'}`} title={showPanels ? "Ocultar Paneles" : "Mostrar Paneles"}>
              {showPanels ? <Minimize size={16}/> : <Maximize size={16}/>}
           </button>
           <button onClick={exportAsPNG} className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl text-white transition-all" title="Exportar PNG"><Download size={16}/></button>
           <button onClick={exportAsJSON} className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl text-white transition-all" title="Exportar JSON"><FileJson size={16}/></button>
           <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={`p-2 rounded-xl text-white transition-all ${isSelectionMode ? 'bg-blue-600' : 'bg-slate-800 hover:bg-blue-600'}`} title={isSelectionMode ? "Modo Selección (Mover múltiples)" : "Modo Navegar (Arrastrar lienzo)"}>
              {isSelectionMode ? <MousePointer2 size={16}/> : <Hand size={16}/>}
           </button>
           <button onClick={deleteSelected} className="p-2 bg-slate-800 hover:bg-red-600 rounded-xl text-white transition-all" title="Eliminar Seleccionados"><Trash2 size={16}/></button>
           <button onClick={toggleFullscreen} className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl text-white transition-all" title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}>
              {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
           </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 h-full w-full relative">
         <DiagramConfigContext.Provider value={{...nodeConfig, equipment, sections, highlightSectionId: selectedSectionId, equipmentSections: equipment.reduce((acc, eq) => ({...acc, [eq.id]: eq.section_id}), {}), sectionsMap: sections?.reduce((acc, s) => ({...acc, [s.id]: s.name}), {}) || {}}}>
           <DiagramActionContext.Provider value={{ onSplitEdge, onDeleteWaypoint, updateEquipment, setNodes }}>
             <ReactFlowProvider>
               <ReactFlow
                 nodes={nodes}
                 edges={edges}
                 onNodesChange={handleNodesChange}
                 onEdgesChange={handleEdgesChange}
                 onConnect={onConnect}
                 onReconnect={onReconnect}
                 edgesReconnectable={true}
                 onInit={setReactFlowInstance}
                 onDrop={onDrop}
                 onDragOver={onDragOver}
                 nodeTypes={nodeTypes}
                 edgeTypes={edgeTypes}
                 onNodeDoubleClick={onNodeDoubleClick}
                 onEdgeDoubleClick={onEdgeDoubleClick}
                 onEdgeContextMenu={onEdgeContextMenu}
                 panOnDrag={!isSelectionMode}
                 selectionOnDrag={isSelectionMode}
                 selectionMode={SelectionMode.Partial}
                 snapToGrid={true}
                 snapGrid={[15, 15]}
                 connectionMode={ConnectionMode.Loose}
                 fitView
                 attributionPosition="bottom-right"
                 className="bg-slate-950"
               >
              <Background color="#334155" gap={24} size={2} />
              <Controls className="bg-slate-800 text-white border-none fill-white" />
              <MiniMap 
                className="bg-slate-900 border border-slate-700 rounded-xl"
                nodeColor={(n) => {
                  return '#3b82f6';
                }}
                maskColor="rgba(15, 23, 42, 0.7)"
              />
              
              {showPanels && (
              /* Cable Selection Panel */
              <Panel position="bottom-center" className="bg-slate-900/80 backdrop-blur rounded-2xl p-2 border border-slate-700 flex gap-2 mb-4">
                 {CABLE_TYPES.map(cable => (
                   <button
                     key={cable.id}
                     onClick={() => setSelectedCableType(cable)}
                     className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                       ${selectedCableType.id === cable.id ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}
                     `}
                     style={{ borderBottom: selectedCableType.id === cable.id ? `2px solid ${cable.color}` : '2px solid transparent' }}
                   >
                     {cable.name}
                   </button>
                 ))}
                 <div className="flex items-center px-2 border-l border-slate-700 ml-1">
                   <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Cable: Arrastrar para mover segmentos/ + Punto</span>
                 </div>
              </Panel>
              )}
           </ReactFlow>
         </ReactFlowProvider>
         </DiagramActionContext.Provider>
        </DiagramConfigContext.Provider>
      </div>

      {/* Right Sidebar - Tools & Inventory */}
      {showPanels && (
      <div className="w-full md:w-80 h-1/3 md:h-full bg-slate-900 border-l border-slate-700 overflow-y-auto overflow-x-auto custom-scrollbar">
        <div className="p-4 border-b border-slate-800 pt-24 md:pt-4">
           <h4 className="text-white font-black uppercase text-xs tracking-widest mb-4">Configuración</h4>
           <div className="grid grid-cols-2 gap-2 mb-4">
             {Object.entries({
               showIcon: 'Ícono', showType: 'Tipo', showStatus: 'Estado', showName: 'Nombre', showIp: 'Direcc. IP', showSubnetMask: 'Máscara', showGateway: 'Gateway', showOs: 'Sist. Oper.', showBrandModel: 'Marca/Mod.', showResponsible: 'Responsab.', showSection: 'Dpto/Secc.', showMac: 'MAC', showSerial: 'Serial'
             }).map(([key, label]) => (
               <label key={key} className="flex items-center gap-2 text-[10px] text-slate-300 font-bold uppercase tracking-widest cursor-pointer hover:text-white transition-colors">
                 <input 
                   type="checkbox" 
                   checked={(nodeConfig as any)[key]} 
                   onChange={(e) => {
                     const newConfig = {...nodeConfig, [key]: e.target.checked};
                     setNodeConfig(newConfig);
                     triggerAutoSave(nodes, edges, newConfig);
                   }} 
                   className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500" 
                 />
                 {label}
               </label>
             ))}
           </div>
           
           <div className="mb-6 mt-2 pb-6 border-b border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-3">Suavizado de Cables</label>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={nodeConfig.edgeRadius || 20} 
                onChange={(e) => {
                  const newConfig = {...nodeConfig, edgeRadius: parseInt(e.target.value)};
                  setNodeConfig(newConfig);
                  triggerAutoSave(nodes, edges, newConfig);
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Recto</span>
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Curvo</span>
              </div>
           </div>

           <h4 className="text-white font-black uppercase text-xs tracking-widest mb-4 border-t border-slate-800 pt-4">Departamentos</h4>
           <div className="flex flex-wrap gap-2 mb-4">
             <button
               onClick={() => setSelectedSectionId(null)}
               className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                 selectedSectionId === null ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'
               }`}
             >
               Todos
             </button>
             {sections?.map(s => (
               <button
                 key={s.id}
                 onClick={() => setSelectedSectionId(s.id)}
                 className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                   selectedSectionId === s.id ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-2 ring-amber-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                 }`}
               >
                 {s.name}
               </button>
             ))}
           </div>

           <h4 className="text-white font-black uppercase text-xs tracking-widest mb-4 border-t border-slate-800 pt-4">Elementos Genéricos</h4>
           <div className="grid grid-cols-3 gap-2">
             {Object.keys(DEVICE_TYPES).slice(0, 9).map((type) => {
                const Icon = DEVICE_TYPES[type];
                return (
                  <div 
                    key={type}
                    onDragStart={(e) => onDragStartSidebar(e, type)}
                    draggable
                    className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl cursor-grab active:cursor-grabbing transition-all"
                  >
                    <Icon className="text-blue-400 w-6 h-6 mb-1" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 text-center">{type}</span>
                  </div>
                )
             })}
           </div>
        </div>

        <div className="p-4">
           <h4 className="text-white font-black uppercase text-xs tracking-widest mb-4">Inventario Existente</h4>
           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">⬇ Arrastra equipos al lienzo</p>
           <div className="space-y-2">
              {equipment.map(eq => {
                 const isAdded = nodes.some(n => n.data.inventoryId === eq.id);
                 return (
                   <div 
                     key={eq.id}
                     draggable={!isAdded}
                     onDragStart={(e) => onDragStartSidebar(e, eq.type, eq.id)}
                     className={`p-3 rounded-xl border flex items-center justify-between transition-all 
                       ${isAdded ? 'bg-slate-800/50 border-slate-800 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:border-blue-500 cursor-grab active:cursor-grabbing'}
                     `}
                   >
                      <div>
                        <p className="text-xs font-bold text-white uppercase truncate">{eq.brand} {eq.model || eq.type}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{eq.net_data?.ip || 'IP No asignada'} • {eq.responsible}</p>
                      </div>
                      {isAdded && <span className="text-[8px] font-black uppercase bg-slate-700 text-slate-300 px-2 py-1 rounded">En uso</span>}
                   </div>
                 )
              })}
           </div>
        </div>
      </div>)}

    </div>
  );
}
