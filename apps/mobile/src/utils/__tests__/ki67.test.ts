// Testes do protótipo (node:test) migrados para Jest, com os mesmos casos.
import type { AnnotationMark } from '@/types';
import {
  calculateInterObserverMetrics,
  calculateKi67Index,
  calculateSpatialCoincidence,
  countMarks,
  formatKi67,
  getKi67Stratification,
} from '@/utils/ki67';

test('Ki-67 formula calculates correctly and rounds to 1 decimal', () => {
  // 142 positive / (142 positive + 358 negative = 500 total) = 28.4%
  expect(calculateKi67Index(142, 358)).toBe(28.4);
});

test('Ki-67 index returns null when there are no marks', () => {
  const index = calculateKi67Index(0, 0);
  expect(index).toBeNull();
  expect(formatKi67(index)).toBe('—');
});

test('Ki-67 format displays one decimal or dash', () => {
  expect(formatKi67(28.4)).toBe('28.4%');
  expect(formatKi67(5.0)).toBe('5.0%');
  expect(formatKi67(null)).toBe('—');
});

test('St. Gallen stratification categorizes into low, intermediate, and high hotspot', () => {
  expect(getKi67Stratification(8.2).level).toBe('low');
  expect(getKi67Stratification(15.0).level).toBe('intermediate');
  expect(getKi67Stratification(28.4).level).toBe('high');
  expect(getKi67Stratification(null).level).toBe('none');
});

test('countMarks counts reagents and non-reagents properly', () => {
  const sampleMarks: AnnotationMark[] = [
    { id: '1', type: 'point', label: 'reagente', isAutoSuggested: false, x: 20, y: 20, createdAt: '' },
    { id: '2', type: 'point', label: 'reagente', isAutoSuggested: true, x: 30, y: 30, createdAt: '' },
    { id: '3', type: 'point', label: 'nao_reagente', isAutoSuggested: false, x: 40, y: 40, createdAt: '' },
  ];
  expect(countMarks(sampleMarks)).toEqual({ reagents: 2, nonReagents: 1, total: 3 });
});

test('Inter-observer metrics calculates min, max, delta in percentage points, and median', () => {
  // 3 blind observers: 28.4%, 27.6%, 29.0%
  const metrics = calculateInterObserverMetrics([28.4, 27.6, 29.0]);
  expect(metrics.min).toBe(27.6);
  expect(metrics.max).toBe(29.0);
  expect(metrics.deltaPP).toBe(1.4);
  expect(metrics.median).toBe(28.4);
  expect(metrics.iccEstimate).toBeGreaterThanOrEqual(0.9);
});

test('Spatial coincidence detects coinciding marks within tolerance', () => {
  const setA: AnnotationMark[] = [
    { id: 'a1', type: 'point', label: 'reagente', isAutoSuggested: false, x: 50, y: 50, createdAt: '' },
    { id: 'a2', type: 'point', label: 'nao_reagente', isAutoSuggested: false, x: 20, y: 20, createdAt: '' },
  ];
  const setB: AnnotationMark[] = [
    { id: 'b1', type: 'point', label: 'reagente', isAutoSuggested: false, x: 51, y: 50.5, createdAt: '' }, // within 3.5%
    { id: 'b2', type: 'point', label: 'nao_reagente', isAutoSuggested: false, x: 21, y: 20, createdAt: '' }, // within 3.5%
  ];
  expect(calculateSpatialCoincidence(setA, setB, 3.5)).toBe(100);
});
