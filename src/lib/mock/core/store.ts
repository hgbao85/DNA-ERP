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

// `state` sống trong bộ nhớ của từng tab — mockStore.get() không tự đọc lại localStorage mỗi lần
// (tốn kém nếu làm vậy). Nếu 1 tab khác ghi đè localStorage (vd nhân viên khác duyệt/từ chối ở tab
// riêng), tab này sẽ không thấy thay đổi cho tới khi tải lại trang, dù người dùng có bấm "Làm mới"
// (Làm mới chỉ gọi lại API — mà API đọc từ `state` trong bộ nhớ, đang cũ). Sự kiện "storage" của
// trình duyệt chỉ bắn ở các tab KHÁC tab vừa ghi — dùng đúng để đồng bộ `state` khi có thay đổi từ
// nơi khác, mà không phải đọc lại localStorage ở mọi lần get().
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as MockState;
      } catch {
        /* ignore */
      }
    }
  });
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
