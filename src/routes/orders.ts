import { Router, Request, Response } from 'express';
import { db } from '../db';
import { Order, OrderItem, CreateOrderInput, OrderStatus } from '../types';
import { requireAdminAuth } from '../auth';

const router = Router();

// GET /api/orders - List all orders with items (Admin only)
router.get('/', requireAdminAuth, async (req: Request, res: Response) => {
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

    const orders = await db.all<Order>(query, params);

    // Fetch items for each order
    const enrichedOrders = await Promise.all(orders.map(async order => {
      const items = await db.all<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      return {
        ...order,
        items
      };
    }));

    res.json(enrichedOrders);
  } catch (error: any) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos', details: error.message });
  }
});

// GET /api/orders/:id - Get order by ID (Admin only)
router.get('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await db.get<Order>('SELECT * FROM orders WHERE id = ?', [id]);

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const items = await db.all<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [id]);
    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar pedido', details: error.message });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customer_name,
      customer_phone,
      delivery_address,
      payment_method,
      notes,
      items,
      status
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

    const validStatus = status === 'Concluído' ? 'Concluído' : (status === 'Preparando' ? 'Preparando' : (status === 'Cancelado' ? 'Cancelado' : 'Pendente'));

    // Execute in transaction
    const tx = await db.client.transaction('write');
    let newOrderId: number;
    try {
      const orderResult = await tx.execute({
        sql: `INSERT INTO orders (customer_name, customer_phone, delivery_address, payment_method, status, total_amount, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          customer_name || 'Cliente',
          customer_phone || '',
          delivery_address.trim(),
          payment_method || 'Pix',
          validStatus,
          totalAmount,
          notes || ''
        ]
      });

      newOrderId = Number(orderResult.lastInsertRowid);

      for (const item of items) {
        await tx.execute({
          sql: `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            newOrderId,
            item.product_id || null,
            item.product_name,
            item.unit_price,
            item.quantity,
            item.unit_price * item.quantity
          ]
        });
      }

      await tx.commit();
    } catch (txError) {
      await tx.rollback();
      throw txError;
    } finally {
      tx.close();
    }

    const createdOrder = await db.get<Order>('SELECT * FROM orders WHERE id = ?', [newOrderId]);
    const createdItems = await db.all<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [newOrderId]);

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
router.patch('/:id/status', requireAdminAuth, async (req: Request, res: Response) => {
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

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [finalStatus, id]);

    res.json({ id: Number(id), status: finalStatus });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar status', details: error.message });
  }
});

// DELETE /api/orders/:id - Delete order (Admin only)
router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    await db.run('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ message: 'Pedido excluído com sucesso', id: Number(id) });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir pedido', details: error.message });
  }
});

export default router;
