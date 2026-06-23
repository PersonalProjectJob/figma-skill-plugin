import { MatchResult } from '../utils/matcher';

export interface RecommendationCardProps {
  match: MatchResult;
  isInserting?: boolean;
  onInsert?: () => void;
}

export function RecommendationCard({ match, isInserting, onInsert }: RecommendationCardProps) {
  const { confidence: score, ...pattern } = match;

  // Determine confidence color
  let confidenceColor = 'text-green-400 bg-green-400/10 border-green-400/20';
  if (score < 60) {
    confidenceColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
  }
  if (score < 30) {
    confidenceColor = 'text-red-400 bg-red-400/10 border-red-400/20';
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg hover:border-gray-600 transition-colors">
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-gray-100 font-semibold text-base leading-tight">{pattern.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${confidenceColor}`}>
            {score}% Match
          </span>
        </div>
        <p className="text-gray-400 text-sm">{pattern.explanation}</p>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Required Anatomy</h4>
          <ul className="space-y-1">
            {pattern.requiredAnatomy.map((item, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-center">
                <svg className="w-3 h-3 mr-2 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Anti-patterns</h4>
          <ul className="space-y-1">
            {pattern.antiPatterns.map((item, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-center">
                <svg className="w-3 h-3 mr-2 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        
        <button 
          onClick={onInsert}
          disabled={isInserting}
          className="w-full mt-2 py-2 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center shadow-sm"
        >
          {isInserting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Inserting...
            </>
          ) : (
            'Insert Component'
          )}
        </button>
      </div>
    </div>
  );
}
