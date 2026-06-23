export interface Pattern {
  patternId: string;
  name: string;
  version: string;
  componentKey: string;
  componentId?: string;
  description?: string;
  signals: string[] | Record<string, number>;
  requiredAnatomy: string[];
  antiPatterns: string[];
  explanation?: string;
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

export interface AuditResult {
  passedAnatomy: string[];
  failedAnatomy: string[];
  foundAntiPatterns: string[];
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

    const signalEntries = Array.isArray(pattern.signals) 
      ? pattern.signals.map(s => [s, 10] as [string, number]) 
      : Object.entries(pattern.signals);

    for (const [signal, weight] of signalEntries) {
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

export function auditDesign(context: FigmaContext, pattern: Pattern): AuditResult {
  const allText = [
    ...context.nodeNames,
    ...context.textContents,
    ...context.componentNames,
    ...context.frameNames
  ].join(' ').toLowerCase();

  const passedAnatomy: string[] = [];
  const failedAnatomy: string[] = [];
  const foundAntiPatterns: string[] = [];

  // Very naive check for demo purposes: 
  // If the anatomy keyword is found in any of the extracted text, it's a pass.
  // We extract the core noun from the anatomy string (e.g. "Email Input" -> "Email")
  for (const item of pattern.requiredAnatomy) {
    // Check if the item's main words exist in the context
    const keywords = item.toLowerCase().split(' ').filter(w => w.length > 2);
    const hasMatch = keywords.some(kw => allText.includes(kw));
    
    if (hasMatch || keywords.length === 0) {
      passedAnatomy.push(item);
    } else {
      failedAnatomy.push(item);
    }
  }

  for (const item of pattern.antiPatterns) {
    const keywords = item.toLowerCase().split(' ').filter(w => w.length > 3);
    // If we find strong anti-pattern keywords in the context, we flag it.
    // For the demo, let's just make it randomly flag one if the context is missing many things.
    // Or we can just do a naive keyword search.
    const hasMatch = keywords.some(kw => allText.includes(kw));
    if (hasMatch) {
      foundAntiPatterns.push(item);
    }
  }

  return { passedAnatomy, failedAnatomy, foundAntiPatterns };
}
