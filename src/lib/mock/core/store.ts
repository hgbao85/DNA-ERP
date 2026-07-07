import { createInitialMockState, type MockState } from '../data/seed';

const LS_KEY = 'sales_crm_mock_v10';

let state: MockState = loadState();

function loadState(): MockState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    /* ignore */
  }
  return createInitialMockState();
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export const mockStore = {
  get(): MockState {
    return state;
  },

  /** Đọc bản clone — tránh mutate ngoài ý muốn */
  snapshot(): MockState {
    return structuredClone(state);
  },

  update(mutator: (draft: MockState) => void): MockState {
    mutator(state);
    persist();
    return state;
  },

  reset(): MockState {
    state = createInitialMockState();
    persist();
    return state;
  },
};
