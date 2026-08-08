// Playwright specs run in Node but evaluate() callbacks run in the page.
// Mirror the page-side test hooks contract here for type-checking.
interface Window {
  __qix?: {
    advanceTicks: (n: number) => void;
    getTicks: () => number;
    isRunning: () => boolean;
    getSummary: () => {
      ticks: number;
      claimedPercent: number;
      marker: { x: number; y: number };
      drawing: boolean;
    };
  };
}
