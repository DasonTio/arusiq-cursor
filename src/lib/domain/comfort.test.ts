import { describe, it, expect } from 'vitest';
import {
  comfortLabelKey,
  comfortSeverity,
  comfortVerdict,
  type ComfortEnvelope,
} from './comfort.ts';

/**
 * A test envelope, not the product's. The point of passing the envelope in is
 * that the domain rule is testable without adopting anybody's thresholds —
 * these edges are chosen to be obviously arbitrary.
 */
const envelope: ComfortEnvelope = {
  temperatureC: { min: 20, max: 25 },
  humidityPct: { min: 30, max: 60 },
};
const { temperatureC: t, humidityPct: h } = envelope;

describe('comfortVerdict — FR-63 plain-language band per room', () => {
  it('calls a room inside both bands comfortable', () => {
    expect(comfortVerdict({ temperatureC: 22, humidityPct: 45 }, envelope)).toBe(
      'comfortable',
    );
  });

  it('includes both edges of the temperature band', () => {
    expect(comfortVerdict({ temperatureC: t.min, humidityPct: 45 }, envelope)).toBe(
      'comfortable',
    );
    expect(comfortVerdict({ temperatureC: t.max, humidityPct: 45 }, envelope)).toBe(
      'comfortable',
    );
  });

  it('includes both edges of the humidity band', () => {
    expect(comfortVerdict({ temperatureC: 22, humidityPct: h.min }, envelope)).toBe(
      'comfortable',
    );
    expect(comfortVerdict({ temperatureC: 22, humidityPct: h.max }, envelope)).toBe(
      'comfortable',
    );
  });

  it('reports too warm above the band and too cool below it', () => {
    expect(
      comfortVerdict({ temperatureC: t.max + 0.1, humidityPct: 45 }, envelope),
    ).toBe('tooWarm');
    expect(
      comfortVerdict({ temperatureC: t.min - 0.1, humidityPct: 45 }, envelope),
    ).toBe('tooCool');
  });

  it('reports humidity only once temperature is inside its band', () => {
    expect(comfortVerdict({ temperatureC: 22, humidityPct: h.max + 1 }, envelope)).toBe(
      'tooHumid',
    );
    expect(comfortVerdict({ temperatureC: 22, humidityPct: h.min - 1 }, envelope)).toBe(
      'tooDry',
    );
  });

  it('answers on temperature even when humidity is missing — a real problem is not hidden behind an absent channel', () => {
    expect(
      comfortVerdict({ temperatureC: t.max + 4, humidityPct: null }, envelope),
    ).toBe('tooWarm');
  });

  it('never claims comfortable from partial evidence', () => {
    expect(comfortVerdict({ temperatureC: 22, humidityPct: null }, envelope)).toBe(
      'unknown',
    );
    expect(comfortVerdict({ temperatureC: null, humidityPct: 45 }, envelope)).toBe(
      'unknown',
    );
    expect(comfortVerdict({ temperatureC: null, humidityPct: null }, envelope)).toBe(
      'unknown',
    );
  });

  it('reads the envelope from its argument rather than a constant of its own', () => {
    const warmer: ComfortEnvelope = {
      temperatureC: { min: 24, max: 30 },
      humidityPct: h,
    };
    const reading = { temperatureC: 22, humidityPct: 45 };
    expect(comfortVerdict(reading, envelope)).toBe('comfortable');
    expect(comfortVerdict(reading, warmer)).toBe('tooCool');
  });
});

describe('comfortSeverity — a warm room is not a failing compressor', () => {
  it('maps comfortable to normal and unknown to unknown', () => {
    expect(comfortSeverity('comfortable')).toBe('normal');
    expect(comfortSeverity('unknown')).toBe('unknown');
  });

  it('caps every discomfort at warning, never critical', () => {
    for (const v of ['tooWarm', 'tooCool', 'tooHumid', 'tooDry'] as const) {
      expect(comfortSeverity(v)).toBe('warning');
    }
  });
});

describe('comfortLabelKey', () => {
  it('namespaces the verdict so no screen writes the words itself', () => {
    expect(comfortLabelKey('tooWarm')).toBe('comfort.tooWarm');
  });
});
