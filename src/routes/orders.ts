import { Router, Request, Response } from 'express';
import { db } from '../db';
import { Order, OrderItem, CreateOrderInput, OrderStatus } from '../types';
import { requireAdminAuth } from '../auth';

const router = Router();

// GET /api/orders - List all orders with items (Admin only)
router.get('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { status, limit, offset, date } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (status && typeof status === 'string' && status !== 'Todos') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (date && typeof date === 'string') {
      query += " AND strftime('%Y-%m-%d', created_at) = ?";
      params.push(date);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
      if (offset) {
        query += ' OFFSET ?';
        params.push(Number(offset));
      }
    }

    const orders = db.prepare(query).all(...params) as Order[];

    // Fetch items for each order
    const getItemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enrichedOrders = orders.map(order => {
      const items = getItemsStmt.all(order.id) as OrderItem[];
      return {
        ...order,
        items
      };
    });

    res.json(enrichedOrders);
  } catch (error: any) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos', details: error.message });
  }
});

// GET /api/orders/:id - Get order by ID (Admin only)
router.get('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as OrderItem[];
    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar pedido', details: error.message });
  }
});

// POST /api/orders - Create new order
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      customer_name,
      customer_phone,
      delivery_address,
      payment_method,
      notes,
      items
    }: CreateOrderInput = req.body;

    if (!delivery_address || delivery_address.trim() === '') {
      return res.status(400).json({ error: 'O endereço de entrega é obrigatório' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'O pedido deve conter pelo menos um item' });
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      if (!item.product_name || item.quantity <= 0 || item.unit_price < 0) {
        return res.status(400).json({ error: 'Dados dos itens inválidos' });
      }
      totalAmount += item.unit_price * item.quantity;
    }

    // Execute in transaction
    const createOrderTx = db.transaction(() => {
      const orderInsert = db.prepare(`
        INSERT INTO orders (customer_name, customer_phone, delivery_address, payment_method, status, total_amount, notes)
        VALUES (?, ?, ?, ?, 'Pendente', ?, ?)
      `);

      const orderResult = orderInsert.run(
        customer_name || 'Cliente',
        customer_phone || '',
        delivery_address.trim(),
        payment_method || 'Pix',
        totalAmount,
        notes || ''
      );

      const orderId = orderResult.lastInsertRowid;

      const itemInsert = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        itemInsert.run(
          orderId,
          item.product_id || null,
          item.product_name,
          item.unit_price,
          item.quantity,
          item.unit_price * item.quantity
        );
      }

      return orderId;
    });

    const newOrderId = createOrderTx();

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(newOrderId) as Order;
    const createdItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(newOrderId) as OrderItem[];

    res.status(201).json({
      ...createdOrder,
      items: createdItems
    });
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido', details: error.message });
  }
});

// PATCH /api/orders/:id/status - Update order status (Admin only)
router.patch('/:id/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    let finalStatus: OrderStatus = 'Pendente';
    const s = String(status || '').trim().toLowerCase();

    if (s === 'pendente') {
      finalStatus = 'Pendente';
    } else if (s === 'preparando') {
      finalStatus = 'Preparando';
    } else if (s === 'concluido' || s === 'concluído') {
      finalStatus = 'Concluído';
    } else if (s === 'cancelado') {
      finalStatus = 'Cancelado';
    } else {
      return res.status(400).json({ error: 'Status de pedido inválido' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(finalStatus, id);

    res.json({ id: Number(id), status: finalStatus });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar status', details: error.message });
  }
});

// DELETE /api/orders/:id - Delete order (Admin only)
router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    res.json({ message: 'Pedido excluído com sucesso', id: Number(id) });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir pedido', details: error.message });
  }
});

export default router;
