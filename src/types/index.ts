export interface Category {
  id: number;
  name: string;
  slug: string;
  product_count?: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  portion?: string;
  flavors?: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  image_url: string;
  active: number; // 1 for active, 0 for inactive
  created_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  portion?: string;
  flavors?: string;
  category_id: number;
  image_url?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  portion?: string;
  flavors?: string;
  category_id?: number;
  image_url?: string;
  active?: number;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id?: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export type OrderStatus = 'Pendente' | 'Preparando' | 'Concluído' | 'Cancelado';

export interface Order {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  payment_method: string;
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface CreateOrderInput {
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  payment_method: string;
  notes?: string;
  status?: OrderStatus;
  items: {
    product_id?: number;
    product_name: string;
    unit_price: number;
    quantity: number;
  }[];
}

export interface ReportSummary {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  completedOrders: number;
  pendingOrders: number;
}

export interface SalesByDate {
  date: string;
  ordersCount: number;
  revenue: number;
}

export interface TopProduct {
  product_name: string;
  image_url: string;
  category_name?: string;
  total_quantity: number;
  total_revenue: number;
}

export interface CategorySales {
  category_name: string;
  total_quantity: number;
  total_revenue: number;
}
