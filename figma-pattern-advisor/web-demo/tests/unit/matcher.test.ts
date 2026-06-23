import { describe, it, expect } from 'vitest';
import { matchPattern, type Pattern, type FigmaContext } from '../../src/plugin-ui/utils/matcher';

const mockPatterns: Pattern[] = [
  {
    patternId: 'pattern.form.submission',
    name: 'Form Submission',
    version: '1.0',
    componentKey: 'form_1',
    signals: {
      'login': 50,
      'submit': 30,
      'password': 20
    },
    requiredAnatomy: [],
    antiPatterns: [],
    explanation: 'Used for forms'
  },
  {
    patternId: 'pattern.data.table',
    name: 'Data Table',
    version: '1.0',
    componentKey: 'table_1',
    signals: {
      'table': 60,
      'row': 20,
      'column': 20
    },
    requiredAnatomy: [],
    antiPatterns: [],
    explanation: 'Used for tables'
  }
];

describe('matcher.ts (Layer 2 Data Algorithm)', () => {
  it('returns the highest scored pattern', () => {
    const context: FigmaContext = {
      nodeNames: ['Login Form'],
      textContents: ['Enter password', 'Submit'],
      componentNames: [],
      frameNames: []
    };

    const result = matchPattern(context, mockPatterns);
    expect(result).not.toBeNull();
    expect(result?.patternId).toBe('pattern.form.submission');
    // 50 (login) + 30 (submit) + 20 (password) = 100
    expect(result?.confidence).toBe(100);
  });

  it('returns null if no signals match or confidence < 20', () => {
    const context: FigmaContext = {
      nodeNames: ['Random Graphic'],
      textContents: ['Hello world'],
      componentNames: [],
      frameNames: []
    };

    const result = matchPattern(context, mockPatterns);
    expect(result).toBeNull();
  });
});
