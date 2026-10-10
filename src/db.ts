import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function getRootDir(): string {
  if (fs.existsSync(path.join(process.cwd(), 'data', 'cardapio.db'))) {
    return process.cwd();
  }
  if (fs.existsSync(path.join(__dirname, '..', 'data', 'cardapio.db'))) {
    return path.join(__dirname, '..');
  }
  return process.cwd();
}

const isVercel = Boolean(process.env.VERCEL);
const projectRoot = getRootDir();

const dataDir = isVercel ? path.join('/tmp', 'data') : path.resolve(projectRoot, 'data');
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.resolve(projectRoot, 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const localDbPath = path.join(dataDir, 'cardapio.db');

// If running on Vercel and DB doesn't exist in /tmp yet and Turso is not configured, copy bundled seed DB
if (isVercel && !process.env.TURSO_DATABASE_URL && !fs.existsSync(localDbPath)) {
  const bundledDbPath = path.resolve(projectRoot, 'data', 'cardapio.db');
  if (fs.existsSync(bundledDbPath)) {
    try {
      fs.copyFileSync(bundledDbPath, localDbPath);
    } catch (e) {
      console.warn('Could not copy bundled DB to /tmp, will initialize fresh DB', e);
    }
  }
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export const isTursoConfigured = Boolean(tursoUrl && tursoToken);

const normalizedLocalPath = localDbPath.replace(/\\/g, '/');

export const client: Client = isTursoConfigured
  ? createClient({
      url: tursoUrl!,
      authToken: tursoToken
    })
  : createClient({
      url: `file:${normalizedLocalPath}`
    });

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export const db = {
  client,
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await client.execute({ sql, args: params });
    return res.rows.map(r => ({ ...r } as unknown as T));
  },
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const res = await client.execute({ sql, args: params });
    if (!res.rows || res.rows.length === 0) return undefined;
    return { ...res.rows[0] } as unknown as T;
  },
  async run(sql: string, params: any[] = []): Promise<RunResult> {
    const res = await client.execute({ sql, args: params });
    return {
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      changes: res.rowsAffected
    };
  },
  async exec(sql: string): Promise<void> {
    await client.executeMultiple(sql);
  }
};

export async function initDatabase(forceReset: boolean = false): Promise<void> {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      portion TEXT,
      flavors TEXT,
      category_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_phone TEXT,
      delivery_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendente',
      total_amount REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
    );
  `);

  // Ensure 'portion' and 'flavors' columns exist on products table
  try {
    const tableInfo = await db.all<{ name: string }>("PRAGMA table_info(products)");
    if (tableInfo.length > 0 && !tableInfo.some(col => col.name === 'portion')) {
      await db.exec("ALTER TABLE products ADD COLUMN portion TEXT;");
    }
    if (tableInfo.length > 0 && !tableInfo.some(col => col.name === 'flavors')) {
      await db.exec("ALTER TABLE products ADD COLUMN flavors TEXT;");
    }

    await db.exec(`
      UPDATE products
      SET portion = SUBSTR(name, INSTR(name, '(') + 1, INSTR(name, ')') - INSTR(name, '(') - 1)
      WHERE (portion IS NULL OR portion = '') AND name LIKE '%(%)%';

      UPDATE products
      SET flavors = 'Queijo, Carne Moída'
      WHERE (flavors IS NULL OR flavors = '') AND name LIKE '%Panqueca%';

      UPDATE products
      SET flavors = 'Muçarela, Calabresa, Frango com Requeijão'
      WHERE (flavors IS NULL OR flavors = '') AND name LIKE '%Pizza Brotinho%';

      UPDATE products
      SET flavors = 'Frango, Palmito'
      WHERE (flavors IS NULL OR flavors = '') AND name LIKE '%Empada%';

      UPDATE products
      SET flavors = 'Frango com Catupiry, Calabresa com Queijo'
      WHERE (flavors IS NULL OR flavors = '') AND name LIKE '%Pão Recheado%';
    `);
  } catch (err) {
    console.error('Migration portion/flavors column error:', err);
  }

  // Seed default admin account if none exists
  await seedDefaultAdmin();

  // Check if current menu already has "Massas Tradicionais"
  const hasMassas = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM categories WHERE slug = 'massas-tradicionais'");
  
  if (forceReset || !hasMassas || hasMassas.count === 0) {
    await populatePadeiroMenu();
  }
}

export async function seedDefaultAdmin(): Promise<void> {
  const adminCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM admins');
  if (!adminCount || adminCount.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('padeiro123', salt, 64).toString('hex');
    await db.run('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)', ['admin', hash, salt]);
  }
}

export async function populatePadeiroMenu(): Promise<void> {
  // Clean up existing data to apply the new cardápio
  try {
    await db.exec(`
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM products;
      DELETE FROM categories;
    `);
  } catch (e) {
    // sqlite_sequence might not exist yet
  }

  // Insert Categories
  await db.run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [1, 'Massas Tradicionais', 'massas-tradicionais']);
  await db.run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [2, 'Seleção de Nhoques', 'selecao-de-nhoques']);
  await db.run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [3, 'Padaria Artesanal', 'padaria-artesanal']);
  await db.run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [4, 'Pizzas & Salgados', 'pizzas-e-salgados']);

  const menuProducts = [
    // --- MASSAS TRADICIONAIS ---
    {
      name: 'Panqueca Caseira (5 unidades)',
      description: 'Queijo ou carne moída temperada, envoltas em molho artesanal da casa. Porção com 5 unidades.',
      price: 45.00,
      category_id: 1,
      image_url: '/assets/padeiro/panqueca.png'
    },
    {
      name: 'Panqueca Caseira (2 unidades)',
      description: 'Queijo ou carne moída temperada, envoltas em molho artesanal da casa. Porção com 2 unidades.',
      price: 20.00,
      category_id: 1,
      image_url: '/assets/padeiro/panqueca.png'
    },
    {
      name: 'Rondelli Especial (600g)',
      description: 'Massa leve artesanal recheada com presunto e queijo fatiada com espirais suculentas. Porção 600g.',
      price: 45.00,
      category_id: 1,
      image_url: '/assets/padeiro/rondelli.png'
    },
    {
      name: 'Rondelli Especial (300g)',
      description: 'Massa leve artesanal recheada com presunto e queijo fatiada com espirais suculentas. Porção 300g.',
      price: 20.00,
      category_id: 1,
      image_url: '/assets/padeiro/rondelli.png'
    },
    {
      name: 'Sofioli Artesanal (600g)',
      description: 'Massa delicada de textura única, recheada generosamente com 3 queijos especiais. Porção 600g.',
      price: 45.00,
      category_id: 1,
      image_url: '/assets/padeiro/rondelli.png'
    },
    {
      name: 'Sofioli Artesanal (300g)',
      description: 'Massa delicada de textura única, recheada generosamente com 3 queijos especiais. Porção 300g.',
      price: 20.00,
      category_id: 1,
      image_url: '/assets/padeiro/rondelli.png'
    },
    {
      name: 'Lasanha da Casa (600g)',
      description: 'Camadas intercaladas com recheio tradicional selecionado e molho encorpado artesanal. Porção 600g.',
      price: 45.00,
      category_id: 1,
      image_url: '/assets/padeiro/lasanha.png'
    },
    {
      name: 'Lasanha da Casa (300g)',
      description: 'Camadas intercaladas com recheio tradicional selecionado e molho encorpado artesanal. Porção 300g.',
      price: 20.00,
      category_id: 1,
      image_url: '/assets/padeiro/lasanha.png'
    },
    {
      name: 'Berinjela à Parmegiana (600g)',
      description: 'Fatias selecionadas, empanadas artesanalmente e cobertas com queijo gratinado e molho. Porção 600g.',
      price: 45.00,
      category_id: 1,
      image_url: '/assets/padeiro/lasanha.png'
    },
    {
      name: 'Berinjela à Parmegiana (300g)',
      description: 'Fatias selecionadas, empanadas artesanalmente e cobertas com queijo gratinado e molho. Porção 300g.',
      price: 20.00,
      category_id: 1,
      image_url: '/assets/padeiro/lasanha.png'
    },

    // --- SELEÇÃO DE NHOQUES ---
    {
      name: 'Nhoque Tradicional de Batata (300g)',
      description: 'Massa artesanal clássica de batata fresca com molho especial. Porção 300g.',
      price: 22.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque Tradicional de Batata (600g)',
      description: 'Massa artesanal clássica de batata fresca com molho especial. Porção 600g.',
      price: 42.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Abóbora (300g)',
      description: 'Delicada massa artesanal de abóbora selecionada com sabor inconfundível. Porção 300g.',
      price: 22.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Abóbora (600g)',
      description: 'Delicada massa artesanal de abóbora selecionada com sabor inconfundível. Porção 600g.',
      price: 42.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Batata Recheado com Queijo (300g)',
      description: 'Nhoque artesanal de batata com recheio cremoso e derretido de queijo. Porção 300g.',
      price: 30.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Batata Recheado com Queijo (600g)',
      description: 'Nhoque artesanal de batata com recheio cremoso e derretido de queijo. Porção 600g.',
      price: 55.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Espinafre Recheado com Provolone (300g)',
      description: 'Massa verde de espinafre com recheio marcante e aromático de provolone. Porção 300g.',
      price: 30.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Espinafre Recheado com Provolone (600g)',
      description: 'Massa verde de espinafre com recheio marcante e aromático de provolone. Porção 600g.',
      price: 55.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Mandioca Recheado com Carne Seca (300g)',
      description: 'Massa artesanal de mandioca com recheio generoso de carne seca desfiada e temperada. Porção 300g.',
      price: 30.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },
    {
      name: 'Nhoque de Mandioca Recheado com Carne Seca (600g)',
      description: 'Massa artesanal de mandioca com recheio generoso de carne seca desfiada e temperada. Porção 600g.',
      price: 55.00,
      category_id: 2,
      image_url: '/assets/padeiro/nhoque.png'
    },

    // --- PADARIA ARTESANAL ---
    {
      name: 'Pão Caseiro Tradicional',
      description: 'Pão artesanal fofinho, feito com amor, fé e fermentação natural.',
      price: 16.00,
      category_id: 3,
      image_url: '/assets/padeiro/paes.png'
    },
    {
      name: 'Brioche Macio',
      description: 'Massa leve, amanteigada, dourada e super macia que derrete na boca.',
      price: 18.00,
      category_id: 3,
      image_url: '/assets/padeiro/paes.png'
    },
    {
      name: 'Pão Recheado Especial',
      description: 'Pão artesanal quentinho com recheio farto de Frango com Catupiry ou Calabresa com Queijo.',
      price: 20.00,
      category_id: 3,
      image_url: '/assets/padeiro/paes.png'
    },
    {
      name: 'Focaccia Rústica (20x20 cm)',
      description: 'Massa rústica italiana crocante por fora e macia por dentro, regada com azeite de oliva e alecrim fresco.',
      price: 40.00,
      category_id: 3,
      image_url: '/assets/padeiro/focaccia.png'
    },
    {
      name: 'Focaccia Rústica (30x30 cm)',
      description: 'Massa rústica italiana tamanho família, generosamente regada com azeite de oliva e alecrim.',
      price: 65.00,
      category_id: 3,
      image_url: '/assets/padeiro/focaccia.png'
    },

    // --- PIZZAS & SALGADOS ---
    {
      name: 'Pizza Brotinho (Semipronta)',
      description: 'Pizza artesanal brotinho semipronta. Sabores: Muçarela, Calabresa ou Frango com Requeijão (unidade).',
      price: 18.00,
      category_id: 4,
      image_url: '/assets/padeiro/empadas.png'
    },
    {
      name: 'Empada Artesanal',
      description: 'Massa podre tradicional amanteigada que derrete na boca. Sabores: Frango ou Palmito (unidade).',
      price: 10.00,
      category_id: 4,
      image_url: '/assets/padeiro/empadas.png'
    },
    {
      name: 'Coxinhas de Frango com Requeijão (10 un)',
      description: 'Porção com 10 coxinhas artesanais de 60g, douradinhas, crocantes e recheadas com frango e requeijão.',
      price: 30.00,
      category_id: 4,
      image_url: '/assets/padeiro/coxinhas.png'
    }
  ];

  for (const prod of menuProducts) {
    const match = prod.name.match(/\((.*?)\)/);
    const portion = match ? match[1].trim() : null;
    let flavors: string | null = null;
    if (prod.name.includes('Panqueca')) {
      flavors = 'Queijo, Carne Moída';
    } else if (prod.name.includes('Pizza Brotinho')) {
      flavors = 'Muçarela, Calabresa, Frango com Requeijão';
    } else if (prod.name.includes('Empada')) {
      flavors = 'Frango, Palmito';
    } else if (prod.name.includes('Pão Recheado')) {
      flavors = 'Frango com Catupiry, Calabresa com Queijo';
    }

    await db.run(
      `INSERT INTO products (name, description, price, portion, flavors, category_id, image_url, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [prod.name, prod.description, prod.price, portion, flavors, prod.category_id, prod.image_url]
    );
  }

  // Seed sample orders to populate reports
  await seedSampleOrders();
}

async function seedSampleOrders(): Promise<void> {
  const getDateAgo = (daysAgo: number, hour: number = 18): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  };

  const sampleOrders = [
    {
      name: 'Maria Helena',
      phone: '11970345627',
      address: 'Rua das Palmeiras, 45',
      payment: 'Pix',
      status: 'Concluído',
      date: getDateAgo(5, 11),
      items: [
        { prodId: 7, name: 'Lasanha da Casa (600g)', price: 45.00, qty: 1 },
        { prodId: 21, name: 'Pão Caseiro Tradicional', price: 16.00, qty: 2 }
      ]
    },
    {
      name: 'Antônio Carlos',
      phone: '11988884433',
      address: 'Av. Brasil, 1200 - Apto 54',
      payment: 'Cartão de Crédito',
      status: 'Concluído',
      date: getDateAgo(4, 18),
      items: [
        { prodId: 3, name: 'Rondelli Especial (600g)', price: 45.00, qty: 1 },
        { prodId: 24, name: 'Focaccia Rústica (20x20 cm)', price: 40.00, qty: 1 }
      ]
    },
    {
      name: 'Juliana Costa',
      phone: '11977771122',
      address: 'Rua Bela Vista, 310',
      payment: 'Pix',
      status: 'Concluído',
      date: getDateAgo(3, 12),
      items: [
        { prodId: 16, name: 'Nhoque de Batata Recheado com Queijo (600g)', price: 55.00, qty: 1 },
        { prodId: 28, name: 'Coxinhas de Frango com Requeijão (10 un)', price: 30.00, qty: 1 }
      ]
    },
    {
      name: 'Fernando Mendes',
      phone: '11966663344',
      address: 'Rua São Paulo, 880',
      payment: 'Dinheiro',
      status: 'Concluído',
      date: getDateAgo(2, 19),
      items: [
        { prodId: 1, name: 'Panqueca Caseira (5 unidades)', price: 45.00, qty: 1 },
        { prodId: 23, name: 'Pão Recheado Especial', price: 20.00, qty: 2 }
      ]
    },
    {
      name: 'Camila Ribeiro',
      phone: '11955557788',
      address: 'Alameda dos Anjos, 102',
      payment: 'Pix',
      status: 'Concluído',
      date: getDateAgo(1, 13),
      items: [
        { prodId: 20, name: 'Nhoque de Mandioca Recheado com Carne Seca (600g)', price: 55.00, qty: 1 },
        { prodId: 22, name: 'Brioche Macio', price: 18.00, qty: 1 }
      ]
    },
    {
      name: 'Roberto Souza',
      phone: '11944449900',
      address: 'Rua Central, 500',
      payment: 'Cartão de Débito',
      status: 'Preparando',
      date: getDateAgo(0, 17),
      items: [
        { prodId: 9, name: 'Berinjela à Parmegiana (600g)', price: 45.00, qty: 1 },
        { prodId: 27, name: 'Empada Artesanal', price: 10.00, qty: 3 }
      ]
    }
  ];

  for (const order of sampleOrders) {
    const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const res = await db.run(
      `INSERT INTO orders (customer_name, customer_phone, delivery_address, payment_method, status, total_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order.name, order.phone, order.address, order.payment, order.status, total, order.date]
    );
    const orderId = res.lastInsertRowid;

    for (const item of order.items) {
      const p = await db.get<{ id: number }>('SELECT id FROM products WHERE name = ?', [item.name]);
      const actualProdId = p ? p.id : null;
      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, actualProdId, item.name, item.price, item.qty, item.price * item.qty]
      );
    }
  }
}
