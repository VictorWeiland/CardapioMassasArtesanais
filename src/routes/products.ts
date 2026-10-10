import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { Product, CreateProductInput, UpdateProductInput } from '../types';
import { requireAdminAuth } from '../auth';

const router = Router();

// Configure multer for product photos
const isVercel = Boolean(process.env.VERCEL);
const projectRoot = process.cwd();
const uploadDir = isVercel ? path.join('/tmp', 'uploads') : path.resolve(projectRoot, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = isVercel
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `prod-${uniqueSuffix}${ext}`);
      }
    });

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo inválido. Apenas JPEG, PNG, WEBP e GIF são permitidos.'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

// GET /api/products - List all products
router.get('/', (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { category_id, active, search } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (active !== undefined && active !== '') {
      query += ' AND p.active = ?';
      params.push(Number(active));
    }

    if (category_id !== undefined && category_id !== '') {
      query += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY p.category_id ASC, p.id ASC';

    const products = db.prepare(query).all(...params) as Product[];
    res.json(products);
  } catch (error: any) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos', details: error.message });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id) as Product | undefined;

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar produto', details: error.message });
  }
});

// POST /api/products - Create new product with photo upload
router.post('/', requireAdminAuth, upload.single('image'), (req: Request, res: Response) => {
  try {
    const { name, description, price, portion, category_id, image_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'O nome do produto é obrigatório' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }

    const parsedCatId = parseInt(category_id, 10);
    if (isNaN(parsedCatId)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    // Determine photo path
    let finalImageUrl = '/assets/padeiro/paes.png'; // default fallback
    if (req.file) {
      if (isVercel && req.file.buffer) {
        finalImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      } else if (req.file.filename) {
        finalImageUrl = `/uploads/${req.file.filename}`;
      }
    } else if (image_url && typeof image_url === 'string' && image_url.trim() !== '') {
      finalImageUrl = image_url.trim();
    }

    const finalPortion = portion && typeof portion === 'string' && portion.trim() !== '' ? portion.trim() : null;

    const stmt = db.prepare(`
      INSERT INTO products (name, description, price, portion, category_id, image_url, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name.trim(),
      description ? description.trim() : '',
      parsedPrice,
      finalPortion,
      parsedCatId,
      finalImageUrl
    );

    const createdProduct = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid) as Product;

    res.status(201).json(createdProduct);
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto', details: error.message });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', requireAdminAuth, upload.single('image'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;

    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const { name, description, price, portion, category_id, image_url, active } = req.body;

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedDesc = description !== undefined ? description.trim() : existing.description;
    const updatedPrice = price !== undefined ? parseFloat(price) : existing.price;
    const updatedPortion = portion !== undefined ? (typeof portion === 'string' && portion.trim() !== '' ? portion.trim() : null) : existing.portion;
    const updatedCatId = category_id !== undefined ? parseInt(category_id, 10) : existing.category_id;
    const updatedActive = active !== undefined ? Number(active) : existing.active;

    let updatedImageUrl = existing.image_url;
    if (req.file) {
      if (isVercel && req.file.buffer) {
        updatedImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      } else if (req.file.filename) {
        updatedImageUrl = `/uploads/${req.file.filename}`;
      }
    } else if (image_url !== undefined && image_url.trim() !== '') {
      updatedImageUrl = image_url.trim();
    }

    db.prepare(`
      UPDATE products
      SET name = ?, description = ?, price = ?, portion = ?, category_id = ?, image_url = ?, active = ?
      WHERE id = ?
    `).run(updatedName, updatedDesc, updatedPrice, updatedPortion, updatedCatId, updatedImageUrl, updatedActive, id);

    const updatedProduct = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id) as Product;

    res.json(updatedProduct);
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto', details: error.message });
  }
});

// PATCH /api/products/:id/toggle - Toggle active status
router.patch('/:id/toggle', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;

    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const newActive = existing.active === 1 ? 0 : 1;
    db.prepare('UPDATE products SET active = ? WHERE id = ?').run(newActive, id);

    res.json({ id: Number(id), active: newActive });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao alternar status do produto', details: error.message });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;

    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    // Optional: If product photo is inside uploads, we could delete it, but keeping it or safely checking
    if (existing.image_url && existing.image_url.startsWith('/uploads/')) {
      const filePath = path.join(uploadDir, path.basename(existing.image_url));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore unlink error
        }
      }
    }

    res.json({ message: 'Produto excluído com sucesso', id: Number(id) });
  } catch (error: any) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ error: 'Erro ao excluir produto', details: error.message });
  }
});

export default router;
