import { Injectable, inject } from '@angular/core';
import { CapabilityRegistryService, AurumCapability, CapabilityCategory, RiskClassification } from './capability-registry.service';

export interface ValidationResult {
  valid: boolean;
  totalChecked: number;
  errors: string[];
  warnings: string[];
  summary: {
    totalCapabilities: number;
    categoriesCovered: string[];
    riskLevelsCovered: string[];
    confirmationGatedCount: number;
    financialCount: number;
  };
}

const VALID_CATEGORIES: CapabilityCategory[] = [
  'NAVIGATION',
  'UI_CONTROL',
  'PORTFOLIO',
  'MARKET',
  'STOCK',
  'RESEARCH',
  'ALERT',
  'ORDER',
  'BROKER',
  'ML',
  'STRATEGY',
  'AUTOMATION',
  'PAPER_TRADING',
  'SETTINGS',
  'VOICE',
  'SYSTEM',
  'GENERAL'
];

const VALID_RISK_LEVELS: RiskClassification[] = [
  'READ_ONLY',
  'SAFE_UI',
  'REVERSIBLE',
  'SENSITIVE',
  'FINANCIAL',
  'DESTRUCTIVE'
];

@Injectable({
  providedIn: 'root'
})
export class CapabilityRegistryValidatorService {
  private readonly registry = inject(CapabilityRegistryService);

  validateRegistry(): ValidationResult {
    const all = this.registry.getAllCapabilities();
    const errors: string[] = [];
    const warnings: string[] = [];
    const ids = new Set<string>();

    const categoriesFound = new Set<string>();
    const riskLevelsFound = new Set<string>();
    let confirmationGatedCount = 0;
    let financialCount = 0;

    for (const cap of all) {
      // 1. Unique ID
      if (!cap.id || typeof cap.id !== 'string' || cap.id.trim().length === 0) {
        errors.push(`Capability has invalid or empty ID: ${JSON.stringify(cap)}`);
      } else if (ids.has(cap.id)) {
        errors.push(`Duplicate capability ID registered: "${cap.id}"`);
      } else {
        ids.add(cap.id);
      }

      // 2. Name & Description
      if (!cap.name || cap.name.trim().length < 3) {
        errors.push(`Capability "${cap.id}" has invalid or missing name`);
      }
      if (!cap.description || cap.description.trim().length < 10) {
        errors.push(`Capability "${cap.id}" has insufficient description (< 10 chars)`);
      }

      // 3. Category Validation
      if (!VALID_CATEGORIES.includes(cap.category as any)) {
        errors.push(`Capability "${cap.id}" has invalid category "${cap.category}"`);
      } else {
        categoriesFound.add(cap.category);
      }

      // 4. Risk Level Validation
      if (!VALID_RISK_LEVELS.includes(cap.riskLevel)) {
        errors.push(`Capability "${cap.id}" has invalid riskLevel "${cap.riskLevel}"`);
      } else {
        riskLevelsFound.add(cap.riskLevel);
      }

      if (cap.riskLevel === 'FINANCIAL') {
        financialCount++;
        // Non-negotiable safety invariant: financial transactions MUST require confirmation
        if (!cap.confirmationRequired) {
          errors.push(`CRITICAL SAFETY VIOLATION: Financial capability "${cap.id}" must have confirmationRequired=true`);
        }
      }

      if (cap.confirmationRequired) {
        confirmationGatedCount++;
      }

      // 5. Parameter Schema Validation
      if (cap.parameters) {
        for (const p of cap.parameters) {
          if (!p.name || typeof p.name !== 'string') {
            errors.push(`Capability "${cap.id}" has a parameter without a valid name`);
          }
          if (!['string', 'number', 'boolean', 'enum'].includes(p.type)) {
            errors.push(`Capability "${cap.id}" parameter "${p.name}" has invalid type "${p.type}"`);
          }
          if (p.type === 'enum' && (!p.options || p.options.length === 0)) {
            errors.push(`Capability "${cap.id}" enum parameter "${p.name}" missing options array`);
          }
        }
      }

      // 6. Test Coverage / Examples
      if (!cap.examples || cap.examples.length === 0) {
        warnings.push(`Capability "${cap.id}" has no example phrases declared for testing`);
      }
    }

    return {
      valid: errors.length === 0,
      totalChecked: all.length,
      errors,
      warnings,
      summary: {
        totalCapabilities: all.length,
        categoriesCovered: Array.from(categoriesFound),
        riskLevelsCovered: Array.from(riskLevelsFound),
        confirmationGatedCount,
        financialCount
      }
    };
  }
}
