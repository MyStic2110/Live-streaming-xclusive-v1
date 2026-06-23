import { z } from 'zod';

/**
 * Shared request schemas. These enforce shape/type at the edge and strip
 * unknown keys, replacing the ad-hoc `if (!x)` checks scattered across
 * controllers. Field requirements mirror existing controller behaviour to
 * preserve backward compatibility.
 */

const email = z.string().trim().email('A valid email address is required.');
const password = z.string().min(1, 'Password is required.');

export const registerSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.').max(255),
  email,
  password,
  // Role is accepted for compatibility but is authoritatively resolved
  // server-side; clients cannot rely on this to self-assign privileges.
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  companyName: z.string().trim().max(255).optional()
}).strip();

export const loginSchema = z.object({
  email,
  password
}).strip();

export const forgotPasswordSchema = z.object({
  email
}).strip();

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
  password: z.string().min(1, 'New password is required.')
}).strip();

/**
 * Query schema for the traces collection — adds pagination + filtering while
 * keeping the response a plain array (no envelope) for frontend compatibility.
 */
export const tracesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  agent: z.string().trim().min(1).max(255).optional(),
  status: z.enum(['streaming', 'completed', 'failed']).optional()
}).strip();
