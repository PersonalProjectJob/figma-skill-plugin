import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PluginApp from '../../src/plugin-ui/App';

describe('Plugin Flow (Layer 3 Integration)', () => {
  it('receives CONTEXT_EXTRACTED and shows recommendation', async () => {
    // 1. Render the Plugin App
    render(<PluginApp />);

    // Initial state: Idle
    expect(screen.getByText('Select elements to analyze')).toBeInTheDocument();

    // 2. Dispatch mock postMessage to simulate Figma extracting context
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            pluginMessage: {
              type: 'CONTEXT_EXTRACTED',
              payload: {
                nodeNames: ['Login Form'],
                textContents: ['Sign In'],
                componentNames: [],
                frameNames: []
              }
            }
          }
        })
      );
    });

    // 3. Status should change to loading or immediately to result (mock logic has a timeout)
    // In App.tsx, mock logic has a 2000ms timeout
    expect(screen.getByText('Analyzing context...')).toBeInTheDocument();

    // 4. Wait for the recommendation to appear
    await waitFor(() => {
      // The matchPattern will return null because we haven't synced patterns yet, 
      // but the status will change to result
      expect(screen.getByText('No Matching Pattern')).toBeInTheDocument();
    }, { timeout: 2500 });
  });
});
