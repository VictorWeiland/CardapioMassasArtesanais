import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './db';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import ordersRouter from './routes/orders';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and tables
initDatabase().catch(err => console.error('Error initializing database:', err));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve root project directory safely across local and Vercel environments
function getRootDir(): string {
  if (fs.existsSync(path.join(process.cwd(), 'index.html'))) {
    return process.cwd();
  }
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    return __dirname;
  }
  if (fs.existsSync(path.join(__dirname, '..', 'index.html'))) {
    return path.join(__dirname, '..');
  }
  return process.cwd();
}

const isVercel = Boolean(process.env.VERCEL);
const rootDir = getRootDir();

app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use('/uploads', express.static(isVercel ? '/tmp/uploads' : path.join(rootDir, 'uploads')));
app.use('/styles', express.static(path.join(rootDir, 'styles')));
app.use('/public', express.static(path.join(rootDir, 'public')));
app.use(express.static(rootDir));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);

// Frontend pages
app.get('/admin', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno no servidor', details: err.message });
});

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n================================================================`);
    console.log(`🥖 PADEIRO - MASSAS & PÃES ARTESANAIS (TYPESCRIPT & SQLITE)`);
    console.log(`================================================================`);
    console.log(`🌐 Servidor:             http://localhost:${PORT}`);
    console.log(`🛒 Cardápio Artesanal:   http://localhost:${PORT}/`);
    console.log(`⚙️  Painel Administrativo: http://localhost:${PORT}/admin`);
    console.log(`📊 Relatórios de Vendas:  http://localhost:${PORT}/admin#reports`);
    console.log(`📞 WhatsApp Encomendas:   (11) 97034-5627`);
    console.log(`================================================================\n`);
  });
}

export default app;
