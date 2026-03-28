/**
 * supabaseAdmin.ts — server-only Supabase client
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS completely.
 * NEVER import this file from client components or pages with 'use client'.
 * Only safe to use in server components, API routes, and server-side services.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabaseAdmin =
  url && serviceKey ? createClient(url, serviceKey) : null;
