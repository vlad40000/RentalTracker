import type { Settings } from "@/lib/data";

export type AppCapabilities = {
  actualPropertyCount: number;
  densePortfolio: boolean;
  mobilePriority: boolean;
  showUnitsByDefault: boolean;
  showImportInPrimaryNav: boolean;
};

export function deriveCapabilities(settings: Settings, actualPropertyCount: number): AppCapabilities {
  const effectivePropertyCount = actualPropertyCount > 0 ? actualPropertyCount : settings.property_count_target;
  return {
    actualPropertyCount,
    densePortfolio: effectivePropertyCount >= 5,
    mobilePriority: settings.phone_access_required,
    showUnitsByDefault: settings.portfolio_unit_type !== "single-family",
    showImportInPrimaryNav: settings.historical_import_months > 0,
  };
}
