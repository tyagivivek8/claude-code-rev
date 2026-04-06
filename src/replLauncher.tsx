import React from 'react';
import type { StatsStore } from './context/stats.js';
import type { Root } from './ink.js';
import type { Props as REPLProps } from './screens/REPL.js';
import type { AppState } from './state/AppStateStore.js';
import type { FpsMetrics } from './utils/fpsTracker.js';
type AppWrapperProps = {
  getFpsMetrics: () => FpsMetrics | undefined;
  stats?: StatsStore;
  initialState: AppState;
};
const _dbg = (msg: string) => { try { require('fs').writeSync(2, msg + '\n') } catch {} };
export async function launchRepl(root: Root, appProps: AppWrapperProps, replProps: REPLProps, renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>): Promise<void> {
  _dbg('[debug:repl] importing App.js...');
  const {
    App
  } = await import('./components/App.js');
  _dbg('[debug:repl] importing REPL.js...');
  const {
    REPL
  } = await import('./screens/REPL.js');
  _dbg('[debug:repl] calling renderAndRun...');
  await renderAndRun(root, <App {...appProps}>
      <REPL {...replProps} />
    </App>);
  _dbg('[debug:repl] renderAndRun returned');
}
