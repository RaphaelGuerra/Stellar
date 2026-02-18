# External Baselines

Use `external-baselines.json` to compare engine outputs with third-party references.

## Flow

1. Copy the `template-astroseek-reference` fixture.
2. Fill `input` and `settings` exactly as used in the external tool.
3. Paste external values into `expected`:
   - `planets`: ecliptic longitudes in degrees.
   - `angles`: `Ascendant` and `MC` longitudes.
   - `houses`: cusp longitudes keyed by house number (`"1"`..`"12"`).
   - `aspects`: exact planet pairs + aspect type (+ optional orb).
4. Set `enabled` to `true`.
5. Run `npm test -- tests/engine-external-baseline.test.ts`.

## Notes

- Keep all values in decimal degrees (0-360).
- Tighten per-fixture tolerances after first successful run.
- Prefer `SwissEphemerisAdapter` for external parity checks.
