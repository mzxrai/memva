import { render, type RenderOptions } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ReactElement } from 'react'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
}

export function renderWithRouter(
  element: ReactElement,
  { initialEntries = ['/'], ...renderOptions }: CustomRenderOptions = {}
) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element,
      },
    ],
    {
      initialEntries,
    }
  )

  return {
    ...render(<RouterProvider router={router} />, renderOptions),
    router,
  }
}

export * from '@testing-library/react'
export { renderWithRouter as render }