
import React from 'react';
import { AppProvider } from './context/AppContext';
import UnifiedView from './views/UnifiedView';

const App: React.FC = () => {
  return (
    <AppProvider>
      <UnifiedView />
    </AppProvider>
  );
};

export default App;
