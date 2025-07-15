import { screen } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * Semantic testing utilities for component tests.
 * Tests functionality and accessibility instead of CSS classes.
 */

export const expectSemanticMarkup = {
  /**
   * Check for a heading with specific level and text
   */
  heading: (level: number, text: string) => {
    const heading = screen.getByRole('heading', { level })
    expect(heading).toHaveTextContent(text)
    return heading
  },

  /**
   * Check for a button that can be interacted with
   */
  button: (name: string) => {
    const button = screen.getByRole('button', { name })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()
    return button
  },

  /**
   * Check for a link with correct href
   */
  link: (text: string, href?: string) => {
    const link = screen.getByRole('link', { name: text })
    expect(link).toBeInTheDocument()
    if (href) {
      expect(link).toHaveAttribute('href', href)
    }
    return link
  },

  /**
   * Check for status/live region for dynamic content
   */
  status: (label?: string) => {
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    if (label) {
      expect(status).toHaveAttribute('aria-label', label)
    }
    return status
  },

  /**
   * Check for main content area
   */
  main: () => {
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    return main
  },

  /**
   * Check for navigation area
   */
  navigation: (label?: string) => {
    const nav = label 
      ? screen.getByRole('navigation', { name: label })
      : screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    return nav
  },

  /**
   * Check for form with proper labeling
   */
  form: (name?: string) => {
    const form = name 
      ? screen.getByRole('form', { name })
      : screen.getByRole('form')
    expect(form).toBeInTheDocument()
    return form
  },

  /**
   * Check for input with proper labeling
   */
  textbox: (name: string) => {
    const input = screen.getByRole('textbox', { name })
    expect(input).toBeInTheDocument()
    return input
  },

  /**
   * Check for list with proper structure
   */
  list: (name?: string) => {
    const list = name 
      ? screen.getByRole('list', { name })
      : screen.getByRole('list')
    expect(list).toBeInTheDocument()
    return list
  },

  /**
   * Check for list item
   */
  listItem: (name?: string) => {
    const listItem = name 
      ? screen.getByRole('listitem', { name })
      : screen.getByRole('listitem')
    expect(listItem).toBeInTheDocument()
    return listItem
  }
}

export const expectContent = {
  /**
   * Check that specific text is visible to users
   */
  text: (text: string) => {
    expect(screen.getByText(text)).toBeVisible()
  },

  /**
   * Check that text is present but may not be visible (e.g., screen reader only)
   */
  textInDocument: (text: string) => {
    expect(screen.getByText(text)).toBeInTheDocument()
  },

  /**
   * Check for code content using proper semantics
   */
  code: (content: string) => {
    const codeElement = screen.getByText(content)
    expect(codeElement.tagName).toBe('CODE')
    return codeElement
  },

  /**
   * Check for preformatted content
   */
  preformatted: (content: string) => {
    const preElement = screen.getByText(content)
    expect(preElement.tagName).toBe('PRE')
    return preElement
  }
}

export const expectInteraction = {
  /**
   * Check that an element can receive focus
   */
  focusable: (element: HTMLElement) => {
    element.focus()
    expect(element).toHaveFocus()
  },

  /**
   * Check that a button is clickable
   */
  clickable: (element: HTMLElement) => {
    expect(element).toBeEnabled()
    expect(element).not.toHaveAttribute('aria-disabled', 'true')
  },

  /**
   * Check for loading state that's announced to screen readers
   */
  loading: (element?: HTMLElement) => {
    if (element) {
      expect(element).toHaveAttribute('aria-busy', 'true')
    } else {
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
    }
  }
}

export const expectAccessibility = {
  /**
   * Check for proper error message association
   */
  errorMessage: (inputName: string, errorText: string) => {
    const input = screen.getByRole('textbox', { name: inputName })
    const errorId = input.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    
    if (errorId) {
      const errorElement = document.getElementById(errorId)
      expect(errorElement).toHaveTextContent(errorText)
      expect(errorElement).toHaveAttribute('role', 'alert')
    }
  },

  /**
   * Check for proper label association
   */
  labeledInput: (labelText: string) => {
    const input = screen.getByLabelText(labelText)
    expect(input).toBeInTheDocument()
    return input
  },

  /**
   * Check for skip links for keyboard navigation
   */
  skipLink: (text: string) => {
    const skipLink = screen.getByRole('link', { name: text })
    expect(skipLink).toHaveAttribute('href')
    return skipLink
  }
}

/**
 * Utility to check if component properly handles keyboard interaction
 */
export const expectKeyboardNavigation = {
  /**
   * Check that Enter key activates buttons
   */
  enterActivatesButton: (button: HTMLElement) => {
    expect(button.tagName).toBe('BUTTON')
    // In tests, we check the element is properly structured for keyboard interaction
    expect(button).not.toHaveAttribute('role', 'button') // Real button, not div with role
  },

  /**
   * Check that Space key activates buttons
   */
  spaceActivatesButton: (button: HTMLElement) => {
    expect(button.tagName).toBe('BUTTON')
    expect(button).not.toHaveAttribute('role', 'button')
  }
}