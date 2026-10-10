import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAdminAuth } from '../auth';

const router = Router();

// Protect all analytical report routes
router.use(requireAdminAuth);

// Helper to get date condition based on period query param
function getDateFilter(period?: string, startDate?: string, endDate?: string): { condition: string; params: any[] } {
  if (startDate && endDate) {
    return {
      condition: " AND date(o.created_at) BETWEEN date(?) AND date(?)",
      params: [startDate, endDate]
    };
  }

  switch (period) {
    case 'today':
      return {
        condition: " AND date(o.created_at) = date('now', 'localtime')",
        params: []
      };
    case '7days':
      return {
        condition: " AND date(o.created_at) >= date('now', '-7 days', 'localtime')",
        params: []
      };
    case '30days':
      return {
        condition: " AND date(o.created_at) >= date('now', '-30 days', 'localtime')",
        params: []
      };
    case 'month':
      return {
        condition: " AND strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now', 'localtime')",
        params: []
      };
    case 'all':
    default:
      return {
        condition: '',
        params: []
      };
  }
}

// GET /api/reports/summary - Overall KPI stats
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate } = req.query as { period?: string; startDate?: string; endDate?: string };
    const dateFilter = getDateFilter(period, startDate, endDate);

    // Revenue and totals excluding canceled orders
    const statsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN o.status != 'Cancelado' THEN o.total_amount ELSE 0 END), 0) as totalRevenue,
        COUNT(o.id) as totalOrders,
        SUM(CASE WHEN o.status = 'Concluído' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN o.status IN ('Pendente', 'Preparando') THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN o.status = 'Cancelado' THEN 1 ELSE 0 END) as canceledOrders
      FROM orders o
      WHERE 1=1 ${dateFilter.condition}
    `;

    const stats = await db.get<{
      totalRevenue: number;
      totalOrders: number;
      completedOrders: number;
      pendingOrders: number;
      canceledOrders: number;
    }>(statsQuery, dateFilter.params) || {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      canceledOrders: 0
    };

    const validOrdersCount = (stats.completedOrders || 0) + (stats.pendingOrders || 0);
    const averageTicket = validOrdersCount > 0 ? stats.totalRevenue / validOrdersCount : 0;

    res.json({
      totalRevenue: Number(stats.totalRevenue.toFixed(2)),
      totalOrders: stats.totalOrders || 0,
      completedOrders: stats.completedOrders || 0,
      pendingOrders: stats.pendingOrders || 0,
      canceledOrders: stats.canceledOrders || 0,
      averageTicket: Number(averageTicket.toFixed(2))
    });
  } catch (error: any) {
    console.error('Erro no resumo de relatórios:', error);
    res.status(500).json({ error: 'Erro ao gerar resumo de relatórios', details: error.message });
  }
});

// GET /api/reports/sales-by-date - Daily trend of orders and revenue
router.get('/sales-by-date', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate } = req.query as { period?: string; startDate?: string; endDate?: string };
    const dateFilter = getDateFilter(period || '30days', startDate, endDate);

    const query = `
      SELECT 
        date(o.created_at) as date,
        COUNT(o.id) as ordersCount,
        COALESCE(SUM(CASE WHEN o.status != 'Cancelado' THEN o.total_amount ELSE 0 END), 0) as revenue
      FROM orders o
      WHERE 1=1 ${dateFilter.condition}
      GROUP BY date(o.created_at)
      ORDER BY date(o.created_at) ASC
    `;

    const results = await db.all(query, dateFilter.params);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar vendas por data', details: error.message });
  }
});

// GET /api/reports/top-products - Top selling products
router.get('/top-products', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate, limit = 10 } = req.query as any;
    const dateFilter = getDateFilter(period, startDate, endDate);

    const query = `
      SELECT 
        oi.product_name,
        COALESCE(p.image_url, '/assets/padeiro/paes.png') as image_url,
        COALESCE(c.name, 'Outros') as category_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status != 'Cancelado' ${dateFilter.condition}
      GROUP BY oi.product_name
      ORDER BY total_quantity DESC
      LIMIT ?
    `;

    const results = await db.all(query, [...dateFilter.params, Number(limit)]);
    res.json(results);
  } catch (error: any) {
    console.error('Erro nos produtos mais vendidos:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos mais vendidos', details: error.message });
  }
});

// GET /api/reports/by-category - Sales distribution by category
router.get('/by-category', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate } = req.query as any;
    const dateFilter = getDateFilter(period, startDate, endDate);

    const query = `
      SELECT 
        COALESCE(c.name, 'Outros') as category_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status != 'Cancelado' ${dateFilter.condition}
      GROUP BY category_name
      ORDER BY total_revenue DESC
    `;

    const results = await db.all(query, dateFilter.params);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar vendas por categoria', details: error.message });
  }
});

// GET /api/reports/payment-methods - Breakdown by payment method
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate } = req.query as any;
    const dateFilter = getDateFilter(period, startDate, endDate);

    const query = `
      SELECT 
        o.payment_method,
        COUNT(o.id) as orders_count,
        SUM(o.total_amount) as total_revenue
      FROM orders o
      WHERE o.status != 'Cancelado' ${dateFilter.condition}
      GROUP BY o.payment_method
      ORDER BY total_revenue DESC
    `;

    const results = await db.all(query, dateFilter.params);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar formas de pagamento', details: error.message });
  }
});

export default router;
