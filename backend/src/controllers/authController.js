import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { JWT_SECRET_KEY } from '../config/jwtConfig.js';

const formatUser = (dbUser) => ({
  id: dbUser.id,
  username: dbUser.username,
  email: dbUser.email,
  role: dbUser.role,
  companyName: dbUser.company_name,
  createdAt: dbUser.created_at
});

/**
 * Validate password complexity:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export const isPasswordStrong = (pw) => {
  if (!pw || pw.length < 8) return false;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw);
  return hasUpper && hasLower && hasNumber && hasSpecial;
};

export const register = async (req, res) => {
  const { username, email, password, role, companyName } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const existingUserRes = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUserRes.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Set first user as admin by default, otherwise defaults to operator
    const countRes = await query('SELECT COUNT(*) FROM users');
    const count = parseInt(countRes.rows[0].count, 10);
    const resolvedRole = count === 0 ? 'admin' : (role || 'operator');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const company = companyName || 'Nexus Swarm Operator';

    const insertRes = await query(
      `INSERT INTO users (username, email, password_hash, role, company_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [username, email.toLowerCase(), passwordHash, resolvedRole, company]
    );

    const newUser = insertRes.rows[0];

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, companyName: newUser.company_name, username: newUser.username },
      JWT_SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      token,
      user: formatUser(newUser)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    // To prevent user enumeration / timing attacks, perform a bcrypt comparison even if the user is not found.
    // This dummy hash uses a typical bcrypt salt/structure.
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuvwxABCDEFGHIJKLMNOPQRSTUVWXYZ1234';
    
    let user = null;
    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
    }

    const passwordHashToCompare = user ? user.password_hash : dummyHash;
    const isMatch = await bcrypt.compare(password, passwordHashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, companyName: user.company_name, username: user.username },
      JWT_SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: formatUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, username, email, role, company_name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(formatUser(userRes.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/auth/forgot-password
 * Generates a secure reset token, hashes it using SHA-256 before DB insertion, sends reset email.
 * Always returns 200 to prevent email enumeration.
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always respond with 200 to prevent user enumeration
    if (userRes.rows.length === 0) {
      return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = userRes.rows[0];

    // Invalidate any existing unused tokens for this user
    await query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Generate a cryptographically secure raw token and hash it for storage
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedToken, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Send email (if EMAIL_USER is configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await sendPasswordResetEmail(user.email, resetUrl, user.username);
    } else {
      // Dev fallback: log the reset URL to console
      console.log(`\n[PASSWORD RESET] Token generated for ${user.email}\n→ Reset URL: ${resetUrl}\n`);
    }

    return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to process reset request.' });
  }
};

/**
 * POST /api/auth/reset-password
 * Validates the reset token and updates the user's password.
 */
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    // Hash the incoming token to match the stored hash in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Look up the token — must be valid, unused, and not expired
    const tokenRes = await query(
      `SELECT prt.*, u.email, u.username 
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [hashedToken]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const resetRecord = tokenRes.rows[0];

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update user's password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRecord.user_id]);

    // Mark the token as used
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetRecord.id]);

    return res.status(200).json({ message: 'Password successfully reset. You can now log in.' });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

