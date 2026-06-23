import type { MatchResult, AuditResult } from '../utils/matcher';

export interface RecommendationCardProps {
  match: MatchResult;
  audit?: AuditResult;
  isInserting?: boolean;
  onInsert?: () => void;
  hideInsert?: boolean;
}

export function RecommendationCard({ match, audit, isInserting, onInsert, hideInsert }: RecommendationCardProps) {
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
          {score > 0 && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${confidenceColor}`}>
              {score}% Match
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm">{pattern.description || pattern.explanation}</p>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Required Anatomy</h4>
          <ul className="space-y-1">
            {pattern.requiredAnatomy.map((item, idx) => {
              let isPass = true;
              if (audit) {
                isPass = audit.passedAnatomy.includes(item);
              }
              
              return (
                <li key={idx} className="text-sm text-gray-300 flex items-center">
                  {audit ? (
                    isPass ? (
                      <svg className="w-4 h-4 mr-2 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-4 h-4 mr-2 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    )
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mr-2" />
                  )}
                  <span className={audit && !isPass ? 'line-through text-gray-500' : ''}>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {pattern.antiPatterns.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Anti-patterns</h4>
            <ul className="space-y-1">
              {pattern.antiPatterns.map((item, idx) => {
                let isWarning = false;
                if (audit) {
                  isWarning = audit.foundAntiPatterns.includes(item);
                }

                return (
                  <li key={idx} className={`text-sm flex items-center ${isWarning ? 'text-yellow-400 font-medium' : 'text-gray-400'}`}>
                    {isWarning ? (
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-2" />
                    )}
                    {item}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        
        {!hideInsert && (
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
        )}
      </div>
    </div>
  );
}
