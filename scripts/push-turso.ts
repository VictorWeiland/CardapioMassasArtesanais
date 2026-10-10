import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error(`\n❌ ERRO: Variáveis do Turso não configuradas.`);
    console.error(`Por favor, adicione no arquivo .env ou informe no terminal:`);
    console.error(`TURSO_DATABASE_URL="libsql://seu-banco.turso.io"`);
    console.error(`TURSO_AUTH_TOKEN="seu-token-aqui"\n`);
    process.exit(1);
  }

  console.log(`\n========================================================`);
  console.log(`🚀 SINCRONIZANDO BANCO LOCAL PARA O TURSO (NUVEM)`);
  console.log(`========================================================`);
  console.log(`📡 Conectando ao Turso: ${tursoUrl}...`);

  const turso = createClient({
    url: tursoUrl,
    authToken: tursoToken
  });

  const localDbPath = path.resolve(process.cwd(), 'data', 'cardapio.db').replace(/\\/g, '/');
  if (!fs.existsSync(localDbPath)) {
    console.error(`❌ Arquivo local data/cardapio.db não encontrado!`);
    process.exit(1);
  }

  const local = createClient({
    url: `file:${localDbPath}`
  });

  console.log(`🛠️ Criando estrutura de tabelas no Turso...`);
  await turso.executeMultiple(`
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

  // 1. Categories
  const localCats = await local.execute('SELECT * FROM categories');
  console.log(`📦 Copiando ${localCats.rows.length} categorias...`);
  for (const cat of localCats.rows) {
    await turso.execute({
      sql: `INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug`,
      args: [cat.id, cat.name, cat.slug]
    });
  }

  // 2. Products
  const localProds = await local.execute('SELECT * FROM products');
  console.log(`🍕 Copiando ${localProds.rows.length} produtos...`);
  for (const prod of localProds.rows) {
    await turso.execute({
      sql: `INSERT INTO products (id, name, description, price, portion, category_id, image_url, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              description = excluded.description,
              price = excluded.price,
              portion = excluded.portion,
              category_id = excluded.category_id,
              image_url = excluded.image_url,
              active = excluded.active`,
      args: [
        prod.id,
        prod.name,
        prod.description,
        prod.price,
        prod.portion,
        prod.category_id,
        prod.image_url,
        prod.active
      ]
    });
  }

  // 3. Admins
  const localAdmins = await local.execute('SELECT * FROM admins');
  console.log(`👤 Copiando ${localAdmins.rows.length} administrador(es)...`);
  for (const adm of localAdmins.rows) {
    await turso.execute({
      sql: `INSERT INTO admins (id, username, password_hash, salt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              username = excluded.username,
              password_hash = excluded.password_hash,
              salt = excluded.salt`,
      args: [adm.id, adm.username, adm.password_hash, adm.salt]
    });
  }

  console.log(`\n========================================================`);
  console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`Seu banco no Turso agora possui todos os dados locais.`);
  console.log(`========================================================\n`);
}

main().catch(err => {
  console.error('❌ Erro na sincronização:', err);
  process.exit(1);
});
