import {
  DomicilioBusiness,
  DomicilioProduct,
  DomicilioOrder,
  DomicilioCustomerProfile,
  BusinessSchedule
} from '../types';

const BIZ_KEY = 'newbank_domicilio_businesses_v1';
const PROD_KEY = 'newbank_domicilio_products_v1';
const ORD_KEY = 'newbank_domicilio_orders_v1';
const CUST_KEY = 'newbank_domicilio_customer_v1';

// Initial Sample Businesses
const INITIAL_BUSINESSES: DomicilioBusiness[] = [
  {
    id: 'biz_1',
    owner_name: 'María Elena Ramos',
    phone: '7845-9201',
    business_name: 'Pupusería & Antojitos Doña María',
    is_24_7: false,
    schedules: [
      {
        id: 's_1',
        days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
        open_time: '06:00',
        close_time: '22:00'
      }
    ],
    latitude: 13.6929,
    longitude: -89.2182,
    address_text: 'Colonia Escalón, Calle El Mirador #402, San Salvador',
    created_at: new Date().toISOString()
  },
  {
    id: 'biz_2',
    owner_name: 'Carlos Humberto Rivas',
    phone: '7123-4567',
    business_name: 'Super Mini Market El Pueblo 24/7',
    is_24_7: true,
    schedules: [],
    latitude: 13.6769,
    longitude: -89.2797,
    address_text: 'Paseo El Carmen, Santa Tecla, La Libertad',
    created_at: new Date().toISOString()
  },
  {
    id: 'biz_3',
    owner_name: 'Ana Lucía Flores',
    phone: '7555-8899',
    business_name: 'Farmacia & Variedades San José',
    is_24_7: false,
    schedules: [
      {
        id: 's_2',
        days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
        open_time: '07:00',
        close_time: '20:00'
      }
    ],
    latitude: 13.6681,
    longitude: -89.2372,
    address_text: 'Bulevar del Hipódromo, Antiguo Cuscatlán',
    created_at: new Date().toISOString()
  }
];

const INITIAL_PRODUCTS: DomicilioProduct[] = [
  {
    id: 'p_1',
    business_id: 'biz_1',
    name: 'Pupusas de Queso con Loroco',
    price: 1.00,
    image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_2',
    business_id: 'biz_1',
    name: 'Pupusas Revueltas (Chicharrón, Frijol y Queso)',
    price: 1.00,
    image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_3',
    business_id: 'biz_1',
    name: 'Tamales de Pollo Especiales',
    price: 1.25,
    image_url: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_4',
    business_id: 'biz_1',
    name: 'Sopa de Gallina India (Sopa completa)',
    price: 6.50,
    image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: false,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_5',
    business_id: 'biz_1',
    name: 'Horchata Artesanal 1/2 Litro',
    price: 1.50,
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_6',
    business_id: 'biz_2',
    name: 'Leche Entera 1 Litro',
    price: 1.80,
    image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_7',
    business_id: 'biz_2',
    name: 'Huevos Frescos de Granja (Cartón 30 u.)',
    price: 4.50,
    image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_8',
    business_id: 'biz_2',
    name: 'Pan de Caja Integral',
    price: 2.20,
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_9',
    business_id: 'biz_3',
    name: 'Multivitamínico Complejo B 100 Tab',
    price: 12.50,
    image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'p_10',
    business_id: 'biz_3',
    name: 'Alcohol Gel Antibacterial 500ml',
    price: 3.50,
    image_url: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?auto=format&fit=crop&w=600&q=80',
    disponible_domicilio: true,
    is_hidden: false,
    created_at: new Date().toISOString()
  }
];

const INITIAL_ORDERS: DomicilioOrder[] = [
  {
    id: 'ord_1',
    business_id: 'biz_1',
    business_name: 'Pupusería & Antojitos Doña María',
    customer_name: 'José Manuel Mejía',
    customer_phone: '7000-1122',
    customer_address: 'Colonia San Benito, Pasaje 3 #12, San Salvador',
    customer_latitude: 13.6950,
    customer_longitude: -89.2230,
    order_date: new Date().toISOString().split('T')[0],
    order_time: '12:30',
    delivery_type: 'domicilio',
    items: [
      {
        product_id: 'p_1',
        product_name: 'Pupusas de Queso con Loroco',
        unit_price: 1.00,
        quantity: 5,
        subtotal: 5.00,
        image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80'
      },
      {
        product_id: 'p_5',
        product_name: 'Horchata Artesanal 1/2 Litro',
        unit_price: 1.50,
        quantity: 2,
        subtotal: 3.00,
        image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
      }
    ],
    total: 8.00,
    additional_note: 'Por favor entregar con salsa de tomate caliente y bastante curtido.',
    status: 'Pendiente',
    created_at: new Date().toISOString()
  },
  {
    id: 'ord_2',
    business_id: 'biz_1',
    business_name: 'Pupusería & Antojitos Doña María',
    customer_name: 'Andrea Beatriz Gómez',
    customer_phone: '7890-4321',
    customer_address: 'Residencial Utila, Polígono E #8, Santa Tecla',
    customer_latitude: 13.6720,
    customer_longitude: -89.2830,
    order_date: new Date().toISOString().split('T')[0],
    order_time: '13:15',
    delivery_type: 'domicilio',
    items: [
      {
        product_id: 'p_2',
        product_name: 'Pupusas Revueltas (Chicharrón, Frijol y Queso)',
        unit_price: 1.00,
        quantity: 4,
        subtotal: 4.00,
        image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80'
      }
    ],
    total: 4.00,
    additional_note: 'Llamar al llegar al portón principal.',
    status: 'Entregado',
    created_at: new Date().toISOString()
  }
];

// Helper Storage Getters & Setters
export function getStoredBusinesses(): DomicilioBusiness[] {
  try {
    const data = localStorage.getItem(BIZ_KEY);
    if (!data) {
      localStorage.setItem(BIZ_KEY, JSON.stringify(INITIAL_BUSINESSES));
      return INITIAL_BUSINESSES;
    }
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_BUSINESSES;
  }
}

export function saveBusinesses(businesses: DomicilioBusiness[]) {
  localStorage.setItem(BIZ_KEY, JSON.stringify(businesses));
}

export function getStoredProducts(): DomicilioProduct[] {
  try {
    const data = localStorage.getItem(PROD_KEY);
    if (!data) {
      localStorage.setItem(PROD_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_PRODUCTS;
  }
}

export function saveProducts(products: DomicilioProduct[]) {
  localStorage.setItem(PROD_KEY, JSON.stringify(products));
}

export function getStoredOrders(): DomicilioOrder[] {
  try {
    const data = localStorage.getItem(ORD_KEY);
    if (!data) {
      localStorage.setItem(ORD_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_ORDERS;
  }
}

export function saveOrders(orders: DomicilioOrder[]) {
  localStorage.setItem(ORD_KEY, JSON.stringify(orders));
}

export function getStoredCustomerProfile(): DomicilioCustomerProfile | null {
  try {
    const data = localStorage.getItem(CUST_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export function saveCustomerProfile(profile: DomicilioCustomerProfile) {
  localStorage.setItem(CUST_KEY, JSON.stringify(profile));
}

// Distance Calculation using Haversine formula (in Km)
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Real-time Business Open/Closed Status Calculator
export function checkIsBusinessOpen(business: DomicilioBusiness): { isOpen: boolean; label: string } {
  if (business.manual_closed) {
    return { isOpen: false, label: 'Cerrado en este momento' };
  }
  if (business.is_24_7) {
    return { isOpen: true, label: 'Abierto 24/7' };
  }
  if (!business.schedules || business.schedules.length === 0) {
    return { isOpen: false, label: 'Cerrado (Sin Horario)' };
  }

  const now = new Date();
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDayName = daysOfWeek[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const sched of business.schedules) {
    if (sched.days.includes(currentDayName)) {
      const [openH, openM] = sched.open_time.split(':').map(Number);
      const [closeH, closeM] = sched.close_time.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (closeMinutes >= openMinutes) {
        if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
          return { isOpen: true, label: `Abierto (Hoy: ${sched.open_time} - ${sched.close_time})` };
        }
      } else {
        // Overnight span
        if (currentMinutes >= openMinutes || currentMinutes <= closeMinutes) {
          return { isOpen: true, label: `Abierto (Hoy: ${sched.open_time} - ${sched.close_time})` };
        }
      }
    }
  }

  return { isOpen: false, label: 'Cerrado en este momento' };
}
