import { hashSeed } from '../../core/mock/rng';

/**
 * Categorical palette for allocation charts / correlation heatmaps. Chosen to read clearly
 * against the dark surface while staying visually distinct from the semantic
 * positive/negative/warning/accent tokens used elsewhere in the UI.
 */
export const CATEGORICAL_PALETTE = [
  '#6366f1', // accent indigo
  '#22c55e', // green
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#f472b6', // pink
  '#a78bfa', // violet
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#94a3b8', // slate (used for "Other" / cash)
];

/** Deterministically assigns a palette color to a category key (stable across reloads). */
export function colorForKey(key: string, index?: number): string {
  if (index !== undefined) return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
  return CATEGORICAL_PALETTE[hashSeed(key) % CATEGORICAL_PALETTE.length];
}
