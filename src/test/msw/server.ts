import { setupServer } from 'msw/node';

// Shared MSW server for Vitest + jsdom tests.
export const server = setupServer();
