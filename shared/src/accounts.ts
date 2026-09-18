import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, 'Use at least 12 characters for your password.').max(128),
}).strict();
export const registrationSchema = credentialsSchema.extend({ name: z.string().trim().min(1).max(80) });
export const userSchema = z.object({ id: z.uuid(), name: z.string(), email: z.email() });
export const sessionSchema = z.object({ user: userSchema.nullable(), csrfToken: z.string().min(32) });
export const siteInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter an installation name.').max(100),
  location: z.string().trim().min(1, 'Enter a location.').max(200),
  capacityKw: z.number().finite().min(0.001).max(1000000)
    .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001, 'Use at most three decimal places.'),
}).strict();
export const siteSchema = siteInputSchema.extend({ id: z.uuid() });
export const sitesSchema = z.object({ sites: z.array(siteSchema) });
export const singleSiteSchema = z.object({ site: siteSchema });
export const siteIdSchema = z.uuid();
export type PublicUser = z.infer<typeof userSchema>;
export type SessionResponse = z.infer<typeof sessionSchema>;
export type SiteInput = z.infer<typeof siteInputSchema>;
export type Site = z.infer<typeof siteSchema>;
