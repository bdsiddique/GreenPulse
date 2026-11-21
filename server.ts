import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Initialize isolated SQLite database for standalone simulations & admin settings
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'simulations.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS standalone_simulations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    horizon_hours INTEGER NOT NULL DEFAULT 24,
    input_mode TEXT NOT NULL DEFAULT 'parametric',
    currency TEXT NOT NULL DEFAULT 'BDT',
    config_json TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS solar_irradiation_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location_tag TEXT DEFAULT '',
    description TEXT DEFAULT '',
    preset_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_name TEXT NOT NULL,
    user_profile_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    recovery_email TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_password_resets (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    recovery_email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenario_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

interface DbRow {
  id: string;
  name: string;
  description: string;
  horizon_hours: number;
  input_mode: string;
  currency: string;
  config_json: string;
  summary_json: string;
  created_at: string;
  updated_at: string;
}

interface StoredUserProfile {
  name: string;
  role: string;
  organization: string;
  email: string;
  locationCity: string;
}

interface AppSettingsRow {
  id: number;
  app_name: string;
  user_profile_json: string;
  updated_at: string;
}

interface AdminCredRow {
  id: number;
  password_hash: string;
  salt: string;
  recovery_email: string;
  updated_at: string;
}

interface PasswordResetRow {
  id: string;
  token_hash: string;
  recovery_email: string;
  expires_at: number;
  used: number;
  attempts: number;
  created_at: number;
}

const DEFAULT_APP_NAME = 'GridPulse';
const DEFAULT_USER_PROFILE: StoredUserProfile = {
  name: 'Tariq Siddique',
  role: 'Lead Power Systems Engineer',
  organization: 'GridPulse Energy Labs',
  email: 'siddique.unm@gmail.com',
  locationCity: 'Dhaka',
};

// Seed default workspace identity once
const existingSettings = db
  .prepare('SELECT id FROM app_settings WHERE id = 1')
  .get() as { id: number } | undefined;

if (!existingSettings) {
  db.prepare(
    `INSERT INTO app_settings (id, app_name, user_profile_json, updated_at)
     VALUES (1, ?, ?, ?)`
  ).run(DEFAULT_APP_NAME, JSON.stringify(DEFAULT_USER_PROFILE), new Date().toISOString());
}

// --- Security & Crypto Helpers ---

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes sliding TTL
const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes single-use reset code
const MAX_RESET_ATTEMPTS = 5;

const adminSessions = new Map<string, { expiresAt: number }>();

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function createAdminSession(): string {
  pruneExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function isValidAdminSession(token: string | null): boolean {
  if (!token) return false;
  const session = adminSessions.get(token);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}

function revokeAllAdminSessions() {
  adminSessions.clear();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!isValidAdminSession(token)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPasswordAgainstHash(password: string, salt: string, storedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return timingSafeHexEqual(derived, storedHash);
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function verifyEnvPasscode(input: string, envPasscode: string): boolean {
  return timingSafeHexEqual(sha256Hex(input), sha256Hex(envPasscode));
}

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function isValidEmail(email: string): boolean {
  if (email.length < 5 || email.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string): string {
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 1) return '***';
  const local = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

// Simple per-IP in-memory rate limiter for auth & reset routes
function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= maxRequests) {
      const retrySec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: `Too many attempts. Please wait ${retrySec} seconds and try again.`,
      });
      return;
    }
    current.count += 1;
    next();
  };
}

// --- SMTP Configuration Helpers (Strictly Server-Side process.env) ---

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (process.env.SMTP_FROM || user || '').trim();
  return { host, port, secure, user, pass, from };
}

function isSmtpConfigured(): boolean {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && Number.isFinite(cfg.port) && cfg.port > 0 && cfg.from && cfg.user && cfg.pass);
}

function readAppSettings(): { appName: string; userProfile: StoredUserProfile } {
  const row = db
    .prepare('SELECT * FROM app_settings WHERE id = 1')
    .get() as AppSettingsRow | undefined;

  if (!row) {
    return { appName: DEFAULT_APP_NAME, userProfile: { ...DEFAULT_USER_PROFILE } };
  }

  let parsedProfile: Partial<StoredUserProfile> = {};
  try {
    parsedProfile = JSON.parse(row.user_profile_json);
  } catch {
    parsedProfile = {};
  }

  return {
    appName: row.app_name || DEFAULT_APP_NAME,
    userProfile: {
      name: sanitizeText(parsedProfile.name, 80) || DEFAULT_USER_PROFILE.name,
      role: sanitizeText(parsedProfile.role, 80) || DEFAULT_USER_PROFILE.role,
      organization: sanitizeText(parsedProfile.organization, 100) || DEFAULT_USER_PROFILE.organization,
      email: sanitizeText(parsedProfile.email, 160) || DEFAULT_USER_PROFILE.email,
      locationCity: sanitizeText(parsedProfile.locationCity, 60) || DEFAULT_USER_PROFILE.locationCity,
    },
  };
}

function getAdminCredentialRow(): AdminCredRow | undefined {
  return db
    .prepare('SELECT * FROM admin_credentials WHERE id = 1')
    .get() as AdminCredRow | undefined;
}

function resolveRecoveryEmail(): string {
  const envEmail = (process.env.ADMIN_RESET_EMAIL || '').trim();
  if (envEmail && isValidEmail(envEmail)) return envEmail;
  const cred = getAdminCredentialRow();
  if (cred?.recovery_email && isValidEmail(cred.recovery_email)) return cred.recovery_email;
  const settings = readAppSettings();
  if (settings.userProfile.email && isValidEmail(settings.userProfile.email)) {
    return settings.userProfile.email;
  }
  return '';
}

function buildAdminStatus(req: Request) {
  const envPass = getEnvAdminPasscode();
  const cred = getAdminCredentialRow();
  const recoveryEmail = resolveRecoveryEmail();
  const authenticated = isValidAdminSession(extractBearerToken(req));
  return {
    adminConfigured: Boolean(envPass || cred),
    envPasscodeActive: Boolean(envPass),
    smtpConfigured: isSmtpConfigured(),
    adminEmailMasked: recoveryEmail ? maskEmail(recoveryEmail) : '',
    authenticated,
  };
}

async function sendPasswordResetEmail(
  toEmail: string,
  resetCode: string,
  appName: string
): Promise<void> {
  const cfg = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });

  const safeAppName = escapeHtml(appName);
  const safeCode = escapeHtml(resetCode);

  await transporter.sendMail({
    from: cfg.from,
    to: toEmail,
    subject: `${appName} — Admin Password Reset Code`,
    text: [
      `A password reset was requested for ${appName} admin settings.`,
      '',
      `Your one-time reset code: ${resetCode}`,
      '',
      'This code expires in 15 minutes and can only be used once.',
      'If you did not request this reset, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="font-size: 18px; margin: 0 0 12px;">${safeAppName} Admin Password Reset</h2>
        <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">
          Use the one-time verification code below to reset the admin password for workspace identity and engineer profile settings:
        </p>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; text-align: center; font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #0f172a;">
          ${safeCode}
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 16px 0 0;">
          This code expires in 15 minutes and is invalidated after a single use. If you did not request a reset, you can ignore this message.
        </p>
      </div>
    `,
  });
}

function serializeRow(row: DbRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    horizonHours: row.horizon_hours,
    inputMode: row.input_mode,
    currency: row.currency,
    config: JSON.parse(row.config_json),
    summary: JSON.parse(row.summary_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const loginRateLimit = createRateLimiter(12, 15 * 60 * 1000);
  const setupRateLimit = createRateLimiter(10, 15 * 60 * 1000);
  const forgotRateLimit = createRateLimiter(5, 15 * 60 * 1000);
  const resetRateLimit = createRateLimiter(8, 15 * 60 * 1000);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', storage: 'sqlite' });
  });

  // =========================================================================
  // Admin-Protected App Identity, User Profile & SMTP Password Reset Routes
  // =========================================================================

  // Public workspace identity + admin status flags (never leaks secrets or raw hashes)
  app.get('/api/admin/settings', (req, res) => {
    try {
      const settings = readAppSettings();
      res.json({
        appName: settings.appName,
        userProfile: settings.userProfile,
        status: buildAdminStatus(req),
      });
    } catch (error) {
      console.error('GET /api/admin/settings failed:', error);
      res.status(500).json({ error: 'Failed to load workspace identity settings.' });
    }
  });

  // Atomic one-time first-run admin password claim (locks itself once claimed)
  app.post('/api/admin/setup', setupRateLimit, (req, res) => {
    try {
      if (getEnvAdminPasscode()) {
        res.status(409).json({
          error: 'An admin password is already managed by the server environment.',
        });
        return;
      }

      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const rawRecoveryEmail = sanitizeText(req.body?.recoveryEmail, 160);

      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'Admin password must be between 8 and 128 characters.' });
        return;
      }

      const settings = readAppSettings();
      const recoveryEmail = rawRecoveryEmail || settings.userProfile.email;
      if (!isValidEmail(recoveryEmail)) {
        res.status(400).json({ error: 'A valid recovery email address is required.' });
        return;
      }

      const claimTx = db.transaction(() => {
        const existing = db
          .prepare('SELECT id FROM admin_credentials WHERE id = 1')
          .get() as { id: number } | undefined;
        if (existing) {
          return false;
        }
        const { hash, salt } = hashPassword(password);
        const now = new Date().toISOString();
        db.prepare(
          `INSERT INTO admin_credentials (id, password_hash, salt, recovery_email, updated_at)
           VALUES (1, ?, ?, ?, ?)`
        ).run(hash, salt, recoveryEmail, now);

        // Sync recovery email into stored profile if user provided a new one
        if (recoveryEmail !== settings.userProfile.email) {
          const nextProfile = { ...settings.userProfile, email: recoveryEmail };
          db.prepare(
            `UPDATE app_settings SET user_profile_json = ?, updated_at = ? WHERE id = 1`
          ).run(JSON.stringify(nextProfile), now);
        }
        return true;
      });

      const claimed = claimTx();
      if (!claimed) {
        res.status(409).json({
          error: 'Admin password has already been configured. Please sign in or reset it.',
        });
        return;
      }

      const token = createAdminSession();
      const updated = readAppSettings();
      res.status(201).json({
        token,
        appName: updated.appName,
        userProfile: updated.userProfile,
        status: {
          ...buildAdminStatus(req),
          adminConfigured: true,
          authenticated: true,
        },
      });
    } catch (error) {
      console.error('POST /api/admin/setup failed:', error);
      res.status(500).json({ error: 'Failed to configure admin password.' });
    }
  });

  // Admin password verification -> returns short-lived in-memory Bearer token
  app.post('/api/admin/login', loginRateLimit, (req, res) => {
    try {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || password.length > 128) {
        res.status(400).json({ error: 'Admin password is required.' });
        return;
      }

      const envPass = getEnvAdminPasscode();
      let verified = false;

      if (envPass) {
        verified = verifyEnvPasscode(password, envPass);
      } else {
        const cred = getAdminCredentialRow();
        if (!cred) {
          res.status(409).json({
            error: 'Admin password has not been set up yet. Set an admin password first.',
          });
          return;
        }
        verified = verifyPasswordAgainstHash(password, cred.salt, cred.password_hash);
      }

      if (!verified) {
        res.status(401).json({ error: 'Incorrect admin password.' });
        return;
      }

      const token = createAdminSession();
      res.json({
        token,
        status: {
          ...buildAdminStatus(req),
          authenticated: true,
        },
      });
    } catch (error) {
      console.error('POST /api/admin/login failed:', error);
      res.status(500).json({ error: 'Failed to verify admin password.' });
    }
  });

  // Revoke active Bearer session
  app.post('/api/admin/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      adminSessions.delete(token);
    }
    res.json({ ok: true });
  });

  // Update protected App Name & User Details (strictly requires verified Admin Bearer token)
  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    try {
      const current = readAppSettings();
      const nextAppName = sanitizeText(req.body?.appName, 60);
      const rawProfile = req.body?.userProfile;

      if (!nextAppName || nextAppName.length < 2) {
        res.status(400).json({ error: 'App name must be between 2 and 60 characters.' });
        return;
      }

      if (!rawProfile || typeof rawProfile !== 'object') {
        res.status(400).json({ error: 'User profile details are required.' });
        return;
      }

      const name = sanitizeText(rawProfile.name, 80);
      const role = sanitizeText(rawProfile.role, 80);
      const organization = sanitizeText(rawProfile.organization, 100);
      const email = sanitizeText(rawProfile.email, 160);
      const locationCity =
        sanitizeText(rawProfile.locationCity, 60) || current.userProfile.locationCity;

      if (!name) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const nextProfile: StoredUserProfile = {
        name,
        role: role || current.userProfile.role,
        organization: organization || current.userProfile.organization,
        email,
        locationCity,
      };

      const now = new Date().toISOString();
      const saveTx = db.transaction(() => {
        db.prepare(
          `UPDATE app_settings
           SET app_name = ?, user_profile_json = ?, updated_at = ?
           WHERE id = 1`
        ).run(nextAppName, JSON.stringify(nextProfile), now);

        db.prepare(
          `UPDATE admin_credentials
           SET recovery_email = ?, updated_at = ?
           WHERE id = 1`
        ).run(email, now);
      });
      saveTx();

      res.json({
        appName: nextAppName,
        userProfile: nextProfile,
        status: buildAdminStatus(req),
      });
    } catch (error) {
      console.error('PUT /api/admin/settings failed:', error);
      res.status(500).json({ error: 'Failed to save protected identity settings.' });
    }
  });

  // Change admin password while authenticated
  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    try {
      if (getEnvAdminPasscode()) {
        res.status(400).json({
          error:
            'Admin password is controlled by the server ADMIN_PASSWORD secret. Update it in Settings → Secrets.',
        });
        return;
      }

      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
        res.status(400).json({
          error: 'Current password is required and new password must be 8–128 characters.',
        });
        return;
      }

      const cred = getAdminCredentialRow();
      if (!cred) {
        res.status(409).json({ error: 'No admin password is stored yet.' });
        return;
      }

      if (!verifyPasswordAgainstHash(currentPassword, cred.salt, cred.password_hash)) {
        res.status(401).json({ error: 'Current admin password is incorrect.' });
        return;
      }

      const { hash, salt } = hashPassword(newPassword);
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE admin_credentials
         SET password_hash = ?, salt = ?, updated_at = ?
         WHERE id = 1`
      ).run(hash, salt, now);

      revokeAllAdminSessions();
      const freshToken = createAdminSession();
      res.json({ ok: true, token: freshToken });
    } catch (error) {
      console.error('POST /api/admin/change-password failed:', error);
      res.status(500).json({ error: 'Failed to update admin password.' });
    }
  });

  // Request one-time SMTP password reset code
  app.post('/api/admin/forgot-password', forgotRateLimit, async (_req, res) => {
    try {
      if (getEnvAdminPasscode()) {
        res.status(400).json({
          error:
            'Admin password is overridden by the server ADMIN_PASSWORD secret. Update ADMIN_PASSWORD in Settings → Secrets to change it.',
        });
        return;
      }

      if (!isSmtpConfigured()) {
        res.status(503).json({
          error:
            'SMTP email delivery is not configured on the server yet. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in server Secrets.',
        });
        return;
      }

      const recoveryEmail = resolveRecoveryEmail();
      if (!recoveryEmail) {
        res.status(400).json({
          error: 'No valid recovery email address is configured for password reset.',
        });
        return;
      }

      const settings = readAppSettings();
      const resetCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex code
      const tokenHash = sha256Hex(resetCode);
      const nowMs = Date.now();
      const expiresAt = nowMs + RESET_TTL_MS;
      const resetId = crypto.randomBytes(12).toString('hex');

      const storeTx = db.transaction(() => {
        db.prepare('UPDATE admin_password_resets SET used = 1 WHERE used = 0').run();
        db.prepare(
          `INSERT INTO admin_password_resets
           (id, token_hash, recovery_email, expires_at, used, attempts, created_at)
           VALUES (?, ?, ?, ?, 0, 0, ?)`
        ).run(resetId, tokenHash, recoveryEmail, expiresAt, nowMs);
      });
      storeTx();

      try {
        await sendPasswordResetEmail(recoveryEmail, resetCode, settings.appName);
      } catch (mailErr) {
        // Invalidate unused reset record if delivery failed
        db.prepare('UPDATE admin_password_resets SET used = 1 WHERE id = ?').run(resetId);
        console.error('SMTP delivery failed (credentials redacted):', (mailErr as Error)?.message);
        res.status(502).json({
          error:
            'Could not deliver the reset email via the configured SMTP server. Verify your SMTP host, port, and credentials.',
        });
        return;
      }

      res.json({
        ok: true,
        maskedEmail: maskEmail(recoveryEmail),
        expiresInMinutes: 15,
      });
    } catch (error) {
      console.error('POST /api/admin/forgot-password failed:', error);
      res.status(500).json({ error: 'Failed to process password reset request.' });
    }
  });

  // Verify one-time reset code & replace admin password
  app.post('/api/admin/reset-password', resetRateLimit, (req, res) => {
    try {
      if (getEnvAdminPasscode()) {
        res.status(400).json({
          error:
            'Admin password is overridden by the server ADMIN_PASSWORD secret. Update it in Settings → Secrets.',
        });
        return;
      }

      const code = sanitizeText(req.body?.code, 32).replace(/\s+/g, '').toUpperCase();
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!code || code.length < 6) {
        res.status(400).json({ error: 'Please enter the reset code sent to your email.' });
        return;
      }
      if (newPassword.length < 8 || newPassword.length > 128) {
        res.status(400).json({ error: 'New admin password must be between 8 and 128 characters.' });
        return;
      }

      const nowMs = Date.now();
      const activeReset = db
        .prepare(
          `SELECT * FROM admin_password_resets
           WHERE used = 0 AND expires_at > ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .get(nowMs) as PasswordResetRow | undefined;

      if (!activeReset || activeReset.attempts >= MAX_RESET_ATTEMPTS) {
        res.status(400).json({
          error: 'Reset code is invalid or expired. Request a fresh reset code.',
        });
        return;
      }

      const candidateHash = sha256Hex(code);
      if (!timingSafeHexEqual(candidateHash, activeReset.token_hash)) {
        const nextAttempts = activeReset.attempts + 1;
        db.prepare(
          `UPDATE admin_password_resets
           SET attempts = ?, used = CASE WHEN ? >= ? THEN 1 ELSE used END
           WHERE id = ?`
        ).run(nextAttempts, nextAttempts, MAX_RESET_ATTEMPTS, activeReset.id);

        const remaining = Math.max(0, MAX_RESET_ATTEMPTS - nextAttempts);
        res.status(400).json({
          error:
            remaining > 0
              ? `Invalid reset code. ${remaining} attempt(s) remaining.`
              : 'Too many invalid attempts. Please request a new reset code.',
        });
        return;
      }

      const { hash, salt } = hashPassword(newPassword);
      const nowIso = new Date().toISOString();

      const applyResetTx = db.transaction(() => {
        db.prepare('UPDATE admin_password_resets SET used = 1 WHERE id = ?').run(activeReset.id);
        db.prepare(
          `INSERT INTO admin_credentials (id, password_hash, salt, recovery_email, updated_at)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             password_hash = excluded.password_hash,
             salt = excluded.salt,
             updated_at = excluded.updated_at`
        ).run(hash, salt, activeReset.recovery_email, nowIso);
      });
      applyResetTx();

      revokeAllAdminSessions();
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/admin/reset-password failed:', error);
      res.status(500).json({ error: 'Failed to reset admin password.' });
    }
  });

  // =========================================================================
  // Standalone Simulations CRUD
  // =========================================================================

  // List all saved standalone simulations
  app.get('/api/simulations', (_req, res) => {
    try {
      const rows = db
        .prepare('SELECT * FROM standalone_simulations ORDER BY updated_at DESC')
        .all() as DbRow[];
      res.json({ simulations: rows.map(serializeRow) });
    } catch (error) {
      console.error('GET /api/simulations failed:', error);
      res.status(500).json({ error: 'Failed to load saved simulations.' });
    }
  });

  // Create a new saved simulation
  app.post('/api/simulations', (req, res) => {
    try {
      const { id, name, description, config, summary } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Simulation name is required.' });
        return;
      }
      if (!config || typeof config !== 'object' || !summary || typeof summary !== 'object') {
        res.status(400).json({ error: 'Simulation config and summary are required.' });
        return;
      }

      const now = new Date().toISOString();
      const recordId =
        typeof id === 'string' && id.trim()
          ? id.trim()
          : `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const horizonHours = Number(config.horizonHours) === 72 ? 72 : 24;
      const inputMode = config.inputMode === 'fabricated' ? 'fabricated' : 'parametric';
      const currency = typeof config.currency === 'string' ? config.currency : 'BDT';

      db.prepare(
        `INSERT INTO standalone_simulations
         (id, name, description, horizon_hours, input_mode, currency, config_json, summary_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        recordId,
        name.trim(),
        typeof description === 'string' ? description.trim() : '',
        horizonHours,
        inputMode,
        currency,
        JSON.stringify(config),
        JSON.stringify(summary),
        now,
        now
      );

      const created = db
        .prepare('SELECT * FROM standalone_simulations WHERE id = ?')
        .get(recordId) as DbRow;

      res.status(201).json({ simulation: serializeRow(created) });
    } catch (error) {
      console.error('POST /api/simulations failed:', error);
      res.status(500).json({ error: 'Failed to save simulation.' });
    }
  });

  // Update an existing saved simulation
  app.put('/api/simulations/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db
        .prepare('SELECT * FROM standalone_simulations WHERE id = ?')
        .get(id) as DbRow | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Saved simulation not found.' });
        return;
      }

      const { name, description, config, summary } = req.body || {};
      const nextName = typeof name === 'string' && name.trim() ? name.trim() : existing.name;
      const nextDescription =
        typeof description === 'string' ? description.trim() : existing.description;
      const nextConfig =
        config && typeof config === 'object' ? config : JSON.parse(existing.config_json);
      const nextSummary =
        summary && typeof summary === 'object' ? summary : JSON.parse(existing.summary_json);
      const nextHorizon = Number(nextConfig.horizonHours) === 72 ? 72 : 24;
      const nextMode = nextConfig.inputMode === 'fabricated' ? 'fabricated' : 'parametric';
      const nextCurrency =
        typeof nextConfig.currency === 'string' ? nextConfig.currency : existing.currency;
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE standalone_simulations
         SET name = ?, description = ?, horizon_hours = ?, input_mode = ?, currency = ?,
             config_json = ?, summary_json = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        nextName,
        nextDescription,
        nextHorizon,
        nextMode,
        nextCurrency,
        JSON.stringify(nextConfig),
        JSON.stringify(nextSummary),
        now,
        id
      );

      const updated = db
        .prepare('SELECT * FROM standalone_simulations WHERE id = ?')
        .get(id) as DbRow;

      res.json({ simulation: serializeRow(updated) });
    } catch (error) {
      console.error('PUT /api/simulations/:id failed:', error);
      res.status(500).json({ error: 'Failed to update simulation.' });
    }
  });

  // Delete a saved simulation
  app.delete('/api/simulations/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare('DELETE FROM standalone_simulations WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Saved simulation not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (error) {
      console.error('DELETE /api/simulations/:id failed:', error);
      res.status(500).json({ error: 'Failed to delete simulation.' });
    }
  });

  // Bulk import / restore saved simulations
  app.post('/api/simulations/import', (req, res) => {
    try {
      const { simulations } = req.body || {};
      if (!Array.isArray(simulations)) {
        res.status(400).json({ error: 'Expected simulations array.' });
        return;
      }

      const upsert = db.prepare(
        `INSERT OR REPLACE INTO standalone_simulations
         (id, name, description, horizon_hours, input_mode, currency, config_json, summary_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const now = new Date().toISOString();
      const tx = db.transaction((items: Array<Record<string, unknown>>) => {
        for (const item of items) {
          if (!item || typeof item !== 'object' || !item.name || !item.config || !item.summary) {
            continue;
          }
          const cfg = item.config as Record<string, unknown>;
          const recId =
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          upsert.run(
            recId,
            String(item.name).trim(),
            typeof item.description === 'string' ? item.description.trim() : '',
            Number(cfg.horizonHours) === 72 ? 72 : 24,
            cfg.inputMode === 'fabricated' ? 'fabricated' : 'parametric',
            typeof cfg.currency === 'string' ? cfg.currency : 'BDT',
            JSON.stringify(cfg),
            JSON.stringify(item.summary),
            typeof item.createdAt === 'string' ? item.createdAt : now,
            now
          );
        }
      });

      tx(simulations);
      const rows = db
        .prepare('SELECT * FROM standalone_simulations ORDER BY updated_at DESC')
        .all() as DbRow[];
      res.json({ simulations: rows.map(serializeRow) });
    } catch (error) {
      console.error('POST /api/simulations/import failed:', error);
      res.status(500).json({ error: 'Failed to import simulations.' });
    }
  });

  // Clear all saved simulations
  app.delete('/api/simulations', (_req, res) => {
    try {
      db.prepare('DELETE FROM standalone_simulations').run();
      res.json({ cleared: true });
    } catch (error) {
      console.error('DELETE /api/simulations failed:', error);
      res.status(500).json({ error: 'Failed to clear simulations.' });
    }
  });

  // Solar Irradiation Presets CRUD
  app.get('/api/solar-presets', (_req, res) => {
    try {
      const rows = db
        .prepare('SELECT * FROM solar_irradiation_presets ORDER BY updated_at DESC')
        .all() as Array<{
        id: string;
        name: string;
        location_tag: string;
        description: string;
        preset_json: string;
        created_at: string;
        updated_at: string;
      }>;
      const presets = rows.map((row) => ({
        ...JSON.parse(row.preset_json),
        id: row.id,
        name: row.name,
        locationTag: row.location_tag || '',
        description: row.description || '',
        isBuiltIn: false,
        updatedAt: row.updated_at,
      }));
      res.json({ presets });
    } catch (error) {
      console.error('GET /api/solar-presets failed:', error);
      res.status(500).json({ error: 'Failed to load solar presets.' });
    }
  });

  app.post('/api/solar-presets', (req, res) => {
    try {
      const preset = req.body?.preset || req.body;
      if (!preset || typeof preset !== 'object' || !preset.name || !String(preset.name).trim()) {
        res.status(400).json({ error: 'Preset name is required.' });
        return;
      }
      const now = new Date().toISOString();
      const recordId =
        typeof preset.id === 'string' && preset.id.trim()
          ? preset.id.trim()
          : `solar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const cleanName = String(preset.name).trim();
      const locationTag = typeof preset.locationTag === 'string' ? preset.locationTag.trim() : '';
      const description = typeof preset.description === 'string' ? preset.description.trim() : '';
      const stored = {
        ...preset,
        id: recordId,
        name: cleanName,
        locationTag,
        description,
        isBuiltIn: false,
        updatedAt: now,
      };
      db.prepare(
        `INSERT OR REPLACE INTO solar_irradiation_presets
         (id, name, location_tag, description, preset_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(recordId, cleanName, locationTag, description, JSON.stringify(stored), now, now);

      res.status(201).json({ preset: stored });
    } catch (error) {
      console.error('POST /api/solar-presets failed:', error);
      res.status(500).json({ error: 'Failed to save solar preset.' });
    }
  });

  app.put('/api/solar-presets/:id', (req, res) => {
    try {
      const { id } = req.params;
      const preset = req.body?.preset || req.body;
      if (!preset || typeof preset !== 'object') {
        res.status(400).json({ error: 'Preset payload is required.' });
        return;
      }
      const now = new Date().toISOString();
      const cleanName = String(preset.name || 'Custom Solar Profile').trim();
      const locationTag = typeof preset.locationTag === 'string' ? preset.locationTag.trim() : '';
      const description = typeof preset.description === 'string' ? preset.description.trim() : '';
      const stored = {
        ...preset,
        id,
        name: cleanName,
        locationTag,
        description,
        isBuiltIn: false,
        updatedAt: now,
      };
      db.prepare(
        `INSERT OR REPLACE INTO solar_irradiation_presets
         (id, name, location_tag, description, preset_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM solar_irradiation_presets WHERE id = ?), ?), ?)`
      ).run(id, cleanName, locationTag, description, JSON.stringify(stored), id, now, now);

      res.json({ preset: stored });
    } catch (error) {
      console.error('PUT /api/solar-presets/:id failed:', error);
      res.status(500).json({ error: 'Failed to update solar preset.' });
    }
  });

  app.delete('/api/solar-presets/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM solar_irradiation_presets WHERE id = ?').run(id);
      res.json({ deleted: true, id });
    } catch (error) {
      console.error('DELETE /api/solar-presets/:id failed:', error);
      res.status(500).json({ error: 'Failed to delete solar preset.' });
    }
  });

  // =========================================================================
  // Saved Scenario Configuration Profiles CRUD (Scenario Manager)
  // =========================================================================

  app.get('/api/scenario-profiles', (_req, res) => {
    try {
      const rows = db
        .prepare('SELECT * FROM scenario_profiles ORDER BY updated_at DESC')
        .all() as Array<{
        id: string;
        name: string;
        description: string;
        config_json: string;
        created_at: string;
        updated_at: string;
      }>;
      const profiles = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        config: JSON.parse(row.config_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      res.json({ profiles });
    } catch (error) {
      console.error('GET /api/scenario-profiles failed:', error);
      res.status(500).json({ error: 'Failed to load scenario profiles.' });
    }
  });

  app.post('/api/scenario-profiles', (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 80);
      const description = sanitizeText(req.body?.description, 200);
      const config = req.body?.config;
      if (!name) {
        res.status(400).json({ error: 'Profile name is required.' });
        return;
      }
      if (!config || typeof config !== 'object') {
        res.status(400).json({ error: 'Configuration payload is required.' });
        return;
      }
      const now = new Date().toISOString();
      const id =
        typeof req.body?.id === 'string' && req.body.id.trim()
          ? req.body.id.trim().slice(0, 64)
          : `prof_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      db.prepare(
        `INSERT INTO scenario_profiles (id, name, description, config_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, name, description, JSON.stringify(config), now, now);

      res.status(201).json({
        profile: {
          id,
          name,
          description,
          config,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      console.error('POST /api/scenario-profiles failed:', error);
      res.status(500).json({ error: 'Failed to save scenario profile.' });
    }
  });

  app.put('/api/scenario-profiles/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db
        .prepare('SELECT * FROM scenario_profiles WHERE id = ?')
        .get(id) as
        | {
            id: string;
            name: string;
            description: string;
            config_json: string;
            created_at: string;
            updated_at: string;
          }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Scenario profile not found.' });
        return;
      }
      const nextName = sanitizeText(req.body?.name, 80) || existing.name;
      const nextDescription =
        typeof req.body?.description === 'string'
          ? sanitizeText(req.body.description, 200)
          : existing.description;
      const nextConfig =
        req.body?.config && typeof req.body.config === 'object'
          ? req.body.config
          : JSON.parse(existing.config_json);
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE scenario_profiles
         SET name = ?, description = ?, config_json = ?, updated_at = ?
         WHERE id = ?`
      ).run(nextName, nextDescription, JSON.stringify(nextConfig), now, id);

      res.json({
        profile: {
          id,
          name: nextName,
          description: nextDescription,
          config: nextConfig,
          createdAt: existing.created_at,
          updatedAt: now,
        },
      });
    } catch (error) {
      console.error('PUT /api/scenario-profiles/:id failed:', error);
      res.status(500).json({ error: 'Failed to update scenario profile.' });
    }
  });

  app.delete('/api/scenario-profiles/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM scenario_profiles WHERE id = ?').run(id);
      res.json({ deleted: true, id });
    } catch (error) {
      console.error('DELETE /api/scenario-profiles/:id failed:', error);
      res.status(500).json({ error: 'Failed to delete scenario profile.' });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GridPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
