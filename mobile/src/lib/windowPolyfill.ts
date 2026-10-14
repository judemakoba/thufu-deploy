// Polyfill module for React Native Hermes environment
// Hermes does not have a 'window' global by default.
// This module provides window as an alias to globalThis.
// Any code that does typeof window !== 'undefined' will get 'object'
// and window.location.href will work (returning 'https://localhost').
export const window = globalThis as unknown as typeof window;
