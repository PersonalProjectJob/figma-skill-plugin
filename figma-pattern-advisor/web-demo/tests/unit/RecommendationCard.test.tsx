import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecommendationCard } from '../../src/plugin-ui/components/RecommendationCard';
import type { MatchResult } from '../../src/plugin-ui/utils/matcher';

const mockMatch: MatchResult = {
  patternId: 'pattern.form.submission',
  name: 'Submission Form',
  version: '1.0.0',
  componentKey: 'key_123',
  signals: {},
  requiredAnatomy: ['Submit Button'],
  antiPatterns: ['Missing clear action'],
  explanation: 'Used for form submission',
  confidence: 90
};

describe('RecommendationCard (Layer 1 UI)', () => {
  it('renders green badge when confidence >= 60', () => {
    render(<RecommendationCard match={mockMatch} />);
    const badge = screen.getByText('90% Match');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-green-400');
  });

  it('renders red badge when confidence < 30', () => {
    const lowMatch = { ...mockMatch, confidence: 20 };
    render(<RecommendationCard match={lowMatch} />);
    const badge = screen.getByText('20% Match');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red-400');
  });

  it('renders yellow badge when confidence between 30 and 59', () => {
    const medMatch = { ...mockMatch, confidence: 45 };
    render(<RecommendationCard match={medMatch} />);
    const badge = screen.getByText('45% Match');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-yellow-400');
  });

  it('shows required anatomy and anti-patterns', () => {
    render(<RecommendationCard match={mockMatch} />);
    expect(screen.getByText('Submit Button')).toBeInTheDocument();
    expect(screen.getByText('Missing clear action')).toBeInTheDocument();
  });
});
