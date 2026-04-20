import { z } from 'zod';

export const portalOverrideSchema = z.string().min(1).optional().describe(
  'Optional LogicMonitor portal override when listener-based auth is configured. If omitted, the server uses lm_session defaultPortal, then LM_PORTAL if configured.'
);
