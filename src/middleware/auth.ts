/**
 * Authentication middleware for HTTP Basic Auth with session persistence.
 */

import { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../types';
import { createSession, validateSession } from '../db/sessions';

const SESSION_COOKIE_NAME = 'noteman_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const authMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  // 1. Check for valid session cookie first
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionCookie) {
    const isValid = await validateSession(c.env.DB, sessionCookie);
    if (isValid) {
      return next();
    }
    // Invalid/expired session - clear the cookie
    deleteCookie(c, SESSION_COOKIE_NAME);
  }

  // 2. Fall back to Basic Auth
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // No auth - send 401 with WWW-Authenticate to trigger browser prompt
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="Noteman"',
    });
  }

  // 3. Validate Basic Auth credentials
  const base64Credentials = authHeader.slice(6);
  let credentials: string;
  try {
    credentials = atob(base64Credentials);
  } catch {
    return c.text('Invalid credentials', 401, {
      'WWW-Authenticate': 'Basic realm="Noteman"',
    });
  }

  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) {
    return c.text('Invalid credentials', 401, {
      'WWW-Authenticate': 'Basic realm="Noteman"',
    });
  }

  const password = credentials.slice(colonIndex + 1);

  if (password !== c.env.AUTH_PASSWORD) {
    return c.text('Invalid credentials', 401, {
      'WWW-Authenticate': 'Basic realm="Noteman"',
    });
  }

  // 4. Valid credentials - create session and set cookie
  const sessionId = await createSession(c.env.DB);
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE,
  });

  return next();
};
