import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Import MSW server setup for API mocking
import '../app/test-utils/msw-server'

// Clean up after each test
afterEach(() => {
  cleanup()
})