export type ChargeEntry = {
  id: string;
  amountCents: number;
  dueDate: string;
  generationKey?: string | null;
  leaseId?: string;
  periodStart?: string;
};

export type AllocationEntry = {
  id: string;
  paymentId: string;
  chargeId: string;
  amountCents: number;
};

export type PaymentEntry = {
  id: string;
  amountCents: number;
};

export type RentGenerationInput = {
  leaseId: string;
  rentTermId: string;
  periodStart: string;
  amountCents: number;
  dueDate: string;
};

export function rentGenerationKey(input: Pick<RentGenerationInput, "leaseId" | "rentTermId" | "periodStart">): string {
  return `${input.leaseId}:${input.rentTermId}:${input.periodStart}:rent`;
}

export function generateRentCharges(
  existing: ChargeEntry[],
  requested: RentGenerationInput[],
): ChargeEntry[] {
  const existingKeys = new Set(existing.map((charge) => charge.generationKey).filter(Boolean));
  const existingPeriods = new Set(existing.filter((charge)=>charge.leaseId&&charge.periodStart).map((charge)=>`${charge.leaseId}:${charge.periodStart}`));
  const created: ChargeEntry[] = [];
  for (const item of requested) {
    const generationKey = rentGenerationKey(item);
    if (existingKeys.has(generationKey) || existingPeriods.has(`${item.leaseId}:${item.periodStart}`)) continue;
    existingKeys.add(generationKey);
    created.push({
      id: `generated:${generationKey}`,
      amountCents: item.amountCents,
      dueDate: item.dueDate,
      generationKey,
      leaseId:item.leaseId,
      periodStart:item.periodStart,
    });
  }
  return created;
}

export function chargeBalance(chargeId: string, charges: ChargeEntry[], allocations: AllocationEntry[]): number {
  const chargeTotal = charges.filter((item) => item.id === chargeId).reduce((sum, item) => sum + item.amountCents, 0);
  const allocated = allocations.filter((item) => item.chargeId === chargeId).reduce((sum, item) => sum + item.amountCents, 0);
  return chargeTotal - allocated;
}

export function allocateOldestFirst(
  payment: PaymentEntry,
  charges: ChargeEntry[],
  existingAllocations: AllocationEntry[],
): AllocationEntry[] {
  if (payment.amountCents <= 0) throw new Error("Payment must be positive");
  let remaining = payment.amountCents;
  const allocations: AllocationEntry[] = [];
  const ordered = [...charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

  for (const charge of ordered) {
    if (remaining === 0) break;
    const open = chargeBalance(charge.id, charges, [...existingAllocations, ...allocations]);
    if (open <= 0) continue;
    const amountCents = Math.min(open, remaining);
    allocations.push({
      id: `allocation:${payment.id}:${charge.id}`,
      paymentId: payment.id,
      chargeId: charge.id,
      amountCents,
    });
    remaining -= amountCents;
  }
  return allocations;
}

export function unappliedAmount(payment: PaymentEntry, allocations: AllocationEntry[]): number {
  return payment.amountCents - allocations.filter((item) => item.paymentId === payment.id).reduce((sum, item) => sum + item.amountCents, 0);
}
