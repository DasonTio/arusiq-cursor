import { describe, expect, it } from 'vitest';
import { PART_CATALOGUE } from './catalogue.ts';
import { createTelemetryAdapter } from './adapter.ts';
import { fixedClock, REFERENCE_NOW } from './clock.ts';
import { asReading, isAbsent } from './readings.ts';
import { walkUnits } from './tree.ts';

const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
const client = { role: 'client' as const, userId: 'user-client' };
const partner = { role: 'technician-thirdparty' as const, userId: 'user-partner' };
const admin = { role: 'admin' as const, userId: 'user-admin' };

describe('simulated telemetry — FR-15 FR-20 FR-34', () => {
  it('is deterministic across two adapter instances', async () => {
    const other = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    const a = await adapter.getClientOverview(client);
    const b = await other.getClientOverview(client);
    expect(a).toEqual(b);
  });

  it('gives every unit twelve parts across the three groups', async () => {
    const properties = await adapter.listProperties(admin);
    const units = walkUnits(properties);
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.parts).toHaveLength(12);
      expect(new Set(unit.parts.map((p) => p.id))).toEqual(
        new Set(PART_CATALOGUE.map((p) => p.id)),
      );
      expect(new Set(unit.parts.map((p) => p.group))).toEqual(
        new Set(['indoor', 'outdoor', 'electrical']),
      );
    }
  });

  it('stamps simulated provenance at the source and never coerces missing to zero', async () => {
    const unit = await adapter.getUnit(client, 'unit-attic-1');
    expect(unit).not.toBeNull();
    const temp = asReading(unit!.live.temperatureC);
    expect(temp?.value).toBeNull();
    expect(temp?.lastSeen).toBeTruthy();
    expect(temp?.provenance).toBe('simulated');
    expect(unit!.device.online).toBe(false);
  });

  it('states an absent CO₂ sensor rather than leaving a blank', async () => {
    const unit = await adapter.getUnit(client, 'unit-kids-1');
    expect(isAbsent(unit!.live.co2Ppm)).toBe(true);
  });

  it('covers unhappy command, tamper and restriction paths', async () => {
    const dining = await adapter.getUnit(client, 'unit-dining-1');
    const study = await adapter.getUnit(client, 'unit-study-1');
    const nursery = await adapter.getUnit(client, 'unit-nursery-1');
    expect(dining?.control.lastCommand?.state).toBe('failed');
    expect(study?.device.tamperSuspected).toBe(true);
    expect(nursery?.restriction?.step).toBe('ecoLockLimitedHours');
    expect(nursery?.restriction?.healthSensitive).toBe(true);
  });

  it('lets unknown outrank normal in a parent roll-up', async () => {
    const overview = await adapter.getClientOverview(client);
    expect(overview?.rollUp.severity).toBe('critical');
    const attic = overview?.rooms.find((r) => r.roomId === 'room-attic');
    expect(attic?.equipment.severity).toBe('unknown');
    expect(attic?.verdict).toBe('unknown');
  });

  it('scopes a client to their home and a partner to assigned units', async () => {
    const homes = await adapter.listProperties(client);
    expect(homes.map((p) => p.id)).toEqual(['prop-bintaro']);
    const partnerTree = await adapter.listProperties(partner);
    const ids = walkUnits(partnerTree).map((u) => u.id);
    expect(ids).toEqual(['unit-study-1']);
    expect(await adapter.getUnit(partner, 'unit-living-1')).toBeNull();
  });

  it('derives Home figures from energy facts, not duplicate literals', async () => {
    const overview = await adapter.getClientOverview(client);
    expect(overview).not.toBeNull();
    const reported = new Set(overview!.energy.actual.map((a) => a.t));
    const monthActual = overview!.energy.actual.reduce((s, p) => s + p.kWh, 0);
    const monthBase = overview!.energy.baseline
      .filter((b) => reported.has(b.t))
      .reduce((s, p) => s + p.kWh, 0);
    const saved = monthBase - monthActual;
    expect(overview!.kpis.savingVsNormal.kWh.value).toBeCloseTo(saved, 1);
    expect(overview!.hero.avoidedKgCO2e.value).toBeCloseTo(
      saved * overview!.hero.gridFactor.value,
      1,
    );
    expect(overview!.hero.avoidedKgCO2e.provenance).toBe('simulated');
    expect(overview!.attention.length).toBeGreaterThan(0);
    expect(overview!.kpis.comfort.unknown).toBeGreaterThan(0);
    expect(
      overview!.kpis.comfort.comfortable + overview!.kpis.comfort.unknown,
    ).toBeLessThanOrEqual(overview!.kpis.comfort.total);
  });

  it('does not invent a zero for an unreported energy day', async () => {
    const series = await adapter.getEnergy(client, 'unit-attic-1', {
      from: '2026-09-01',
      to: '2026-09-18',
    });
    expect(series.completeness).toBeLessThan(1);
    expect(series.actual.every((p) => p.kWh !== 0 || series.actual.length === 0)).toBe(
      true,
    );
  });
});

describe('a count never reports a negative', () => {
  it('keeps zero-nominal signals at or above zero', async () => {
    // Frost minutes, overflow events, louver faults and contactor chatter all
    // count occurrences. The jitter around a nominal is symmetric, so half of
    // those rolls used to land below zero and the unit screen published
    // "−1 min" of frost and "−0 n" of overflow — a reading that cannot
    // physically exist, on the screen a technician diagnoses from.
    const counts = new Set(
      PART_CATALOGUE.flatMap((part) =>
        part.signals.filter((s) => s.nominal === 0).map((s) => `${part.id}.${s.key}`),
      ),
    );
    expect(counts.size).toBeGreaterThan(0);

    const properties = await adapter.listProperties(admin);
    const units = walkUnits(properties);
    expect(units.length).toBeGreaterThan(0);

    for (const unit of units) {
      const record = await adapter.getUnit(admin, unit.id);
      for (const part of record?.parts ?? []) {
        for (const signal of part.signals) {
          const short = signal.key.split('.').at(-1);
          if (!counts.has(`${part.id}.${short}`)) continue;
          const reading = signal.reading;
          if (reading && 'value' in reading && typeof reading.value === 'number') {
            expect(reading.value).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});
