import type { ExtractionEvent, WorkManifest } from '@daas/contracts';
import { event, unsignedManifest, withDigest } from './fixtures.ts';

// Checked by tsc: producer/consumer types come from the exported schemas.
const valid: ExtractionEvent = event;
const validManifest: WorkManifest = withDigest('a'.repeat(64));
// @ts-expect-error SQL identifiers must travel as strings, never lossy numbers.
const invalidId: ExtractionEvent = { ...event, url_id: 3 };
// @ts-expect-error Required wire fields cannot be omitted from producer output.
const missing: ExtractionEvent = { schema_version: 1 };
// @ts-expect-error The immutable launch digest is required.
const missingDigest: WorkManifest = unsignedManifest;
// @ts-expect-error Outcome vocabulary is closed in schema v1.
const invalidOutcome: ExtractionEvent = { ...event, outcome: 'maybe' };
void [valid, validManifest, invalidId, missing, missingDigest, invalidOutcome];
