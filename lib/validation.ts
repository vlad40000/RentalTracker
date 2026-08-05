import { z } from "zod";

export const setupSchema = z.object({
  propertyCountTarget: z.coerce.number().int().min(1).max(1000),
  portfolioUnitType: z.enum(["single-family", "multi-unit", "mixed"]),
  phoneAccessRequired: z.enum(["yes", "no"]).transform((value: string) => value === "yes"),
  historicalImportMonths: z.coerce.number().int().min(0).max(1200),
});

export const propertySchema = z.object({
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  notes: z.string().trim().max(5000).optional(),
  unitMode: z.enum(["single-family", "multi-unit"]),
  unitCount: z.coerce.number().int().min(1).max(500),
});

export const paymentSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid().optional().or(z.literal("")),
  payerName: z.string().trim().min(1).max(200),
  amount: z.string().min(1),
  receivedDate: z.iso.date(),
  method: z.enum(["cash", "check", "ach", "card", "money_order", "zelle", "venmo", "other"]),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const expenseSchema = z.object({
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().optional().or(z.literal("")),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  amount: z.string().min(1),
  expenseDate: z.iso.date(),
  vendor: z.string().trim().max(200).optional(),
});

export const oneOffChargeSchema = z.object({
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().optional().or(z.literal("")),
  tenantId: z.string().uuid().optional().or(z.literal("")),
  chargeType: z.enum(["late_fee", "repair_chargeback", "adjustment"]),
  description: z.string().trim().min(1).max(500),
  amount: z.string().min(1),
  effectiveDate: z.iso.date(),
  dueDate: z.iso.date(),
});
