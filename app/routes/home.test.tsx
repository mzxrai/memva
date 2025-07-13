import { render, screen } from '../../test/test-utils'
import { describe, it, expect } from 'vitest'
import Home from './home'

describe('Home Route', () => {
  it('should render welcome component', () => {
    render(<Home />)
    
    expect(screen.getByText("What's next?")).toBeInTheDocument()
    expect(screen.getByText('React Router Docs')).toBeInTheDocument()
  })
})