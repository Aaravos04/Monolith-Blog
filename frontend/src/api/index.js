import { mockApi } from './mockApi';
import { realApi } from './realApi';

// Set VITE_USE_MOCK=false in .env to talk to your Django backend instead.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// Both implementations expose the exact same functions, so pages never care which is active.
const api = realApi;

export { USE_MOCK, api };
