export interface Pattern {
  patternId: string;
  name: string;
  version: string;
  componentKey: string;
  componentId?: string;
  signals: Record<string, number>;
  requiredAnatomy: string[];
  antiPatterns: string[];
  explanation: string;
}

export interface MatchResult extends Pattern {
  confidence: number;
}

export interface FigmaContext {
  nodeNames: string[];
  textContents: string[];
  componentNames: string[];
  frameNames: string[];
}

export function matchPattern(context: FigmaContext, patterns: Pattern[]): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  let highestScore = 0;

  const allText = [
    ...context.nodeNames,
    ...context.textContents,
    ...context.componentNames,
    ...context.frameNames
  ].join(' ').toLowerCase();

  for (const pattern of patterns) {
    let score = 0;
    let maxPossibleScore = 0;

    for (const [signal, weight] of Object.entries(pattern.signals)) {
      maxPossibleScore += weight;
      if (allText.includes(signal.toLowerCase())) {
        score += weight;
      }
    }

    if (score > highestScore && score > 0) {
      highestScore = score;
      const confidence = Math.round((score / maxPossibleScore) * 100);
      bestMatch = { ...pattern, confidence };
    }
  }

  if (bestMatch && bestMatch.confidence >= 20) {
    return bestMatch;
  }

  return null;
}
