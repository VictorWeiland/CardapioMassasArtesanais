import { Router, Request, Response } from 'express';
import { db } from '../db';
import { Category } from '../types';
import { requireAdminAuth } from '../auth';

const router = Router();

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-');
}

// GET /api/categories - List categories with product count
router.get('/', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.id ASC
    `).all() as (Category & { product_count: number })[];
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar categorias', details: error.message });
  }
});

// POST /api/categories - Create new category
router.post('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'O nome da categoria é obrigatório' });
    }

    const trimmedName = name.trim();
    let slug = slugify(trimmedName);
    if (!slug) {
      slug = 'cat-' + Date.now();
    }

    // Check if category or slug already exists
    const existing = db.prepare('SELECT * FROM categories WHERE LOWER(name) = LOWER(?) OR slug = ?').get(trimmedName, slug) as Category | undefined;
    if (existing) {
      return res.status(400).json({ error: 'Já existe uma categoria cadastrada com este nome.' });
    }

    const result = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(trimmedName, slug);

    const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category;
    res.status(201).json(newCategory);
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria', details: error.message });
  }
});

// DELETE /api/categories/:id - Delete category (if no products are assigned)
router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const catId = parseInt(id as string, 10);
    if (isNaN(catId)) {
      return res.status(400).json({ error: 'ID de categoria inválido' });
    }

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId) as Category | undefined;
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Check if products exist in this category
    const productCountResult = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(catId) as { count: number };
    if (productCountResult.count > 0) {
      return res.status(400).json({
        error: `Não é possível excluir esta categoria porque há ${productCountResult.count} produto(s) associado(s) a ela. Mova ou exclua os produtos primeiro.`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
    res.json({ success: true, message: 'Categoria excluída com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir categoria:', error);
    res.status(500).json({ error: 'Erro ao excluir categoria', details: error.message });
  }
});

export default router;
