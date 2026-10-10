import { Router, Request, Response } from 'express';
import { db } from '../db';
import { verifyPassword, hashPassword, generateToken, requireAdminAuth, AuthenticatedRequest } from '../auth';

const router = Router();

// POST /api/auth/login - Autenticação do Administrador
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário e senha para acessar.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim()) as any;

    if (!admin) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const isMatch = verifyPassword(password, admin.salt, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Gerar token de sessão válido por 30 dias
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      INSERT INTO sessions (admin_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(admin.id, token, expiresAtStr);

    res.json({
      message: 'Login realizado com sucesso',
      token,
      username: admin.username,
      expires_at: expiresAtStr
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor ao realizar login', details: error.message });
  }
});

// GET /api/auth/verify - Verificar se sessão continua ativa
router.get('/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    authenticated: true,
    user: req.adminUser
  });
});

// POST /api/auth/logout - Encerrar sessão
router.post('/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ message: 'Sessão encerrada com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao encerrar sessão', details: error.message });
  }
});

// POST /api/auth/change-password - Trocar senha de acesso
router.post('/change-password', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.adminUser!.id) as any;
    if (!admin) {
      return res.status(404).json({ error: 'Administrador não encontrado.' });
    }

    const isMatch = verifyPassword(currentPassword, admin.salt, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, admin.id);

    // Opcional: remover sessões antigas
    res.json({ message: 'Senha alterada com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao trocar senha', details: error.message });
  }
});

export default router;
