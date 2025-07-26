import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffViewer } from '../components/events/DiffViewer'

describe('DiffViewer Smart Hunks', () => {
  it('should show changes when they appear after the truncation point', () => {
    // Create a diff where changes start at line 15
    const oldString = Array(20).fill(null).map((_, i) => `Line ${i + 1}`).join('\n')
    const newString = Array(20).fill(null).map((_, i) => {
      if (i === 14) return `Line ${i + 1} - MODIFIED`  // Line 15
      if (i === 15) return `Line ${i + 1} - MODIFIED`  // Line 16
      return `Line ${i + 1}`
    }).join('\n')
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
    
    // Should show the changes even though they're at line 15-16
    expect(screen.getByText(/Line 15 - MODIFIED/)).toBeInTheDocument()
    expect(screen.getByText(/Line 16 - MODIFIED/)).toBeInTheDocument()
    
    // Should show context lines before the change
    expect(screen.getByText(/Line 12/)).toBeInTheDocument() // 3 lines before
    expect(screen.getByText(/Line 13/)).toBeInTheDocument()
    expect(screen.getByText(/Line 14/)).toBeInTheDocument()
  })

  it('should show indicator when there are hidden changes below', () => {
    // Create a diff with changes at line 5 and line 50
    const lines = Array(100).fill(null).map((_, i) => `Line ${i + 1}`)
    const oldString = lines.join('\n')
    const newString = lines.map((line, i) => {
      if (i === 4) return `${line} - CHANGE 1`   // Line 5
      if (i === 49) return `${line} - CHANGE 2`  // Line 50
      return line
    }).join('\n')
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
    
    // Should show the first change
    expect(screen.getByText(/Line 5 - CHANGE 1/)).toBeInTheDocument()
    
    // Should show indicator for hidden changes (counts removed + added as 2 changes)
    expect(screen.getByText(/↓ 2 more changed lines below/)).toBeInTheDocument()
    
    // Should NOT show the second change (it's beyond the limit)
    expect(screen.queryByText(/Line 50 - CHANGE 2/)).not.toBeInTheDocument()
  })

  it('should group nearby changes into a single hunk', () => {
    const oldString = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10`
    
    const newString = `Line 1
Line 2
Line 3 - MODIFIED
Line 4
Line 5 - MODIFIED
Line 6 - MODIFIED
Line 7
Line 8
Line 9
Line 10`
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
    
    // All nearby changes should be visible in one hunk
    expect(screen.getByText(/Line 3 - MODIFIED/)).toBeInTheDocument()
    expect(screen.getByText(/Line 5 - MODIFIED/)).toBeInTheDocument()
    expect(screen.getByText(/Line 6 - MODIFIED/)).toBeInTheDocument()
    
    // Should include context
    expect(screen.getByText(/Line 1/)).toBeInTheDocument() // Context before
    expect(screen.getByText(/Line 7/)).toBeInTheDocument() // Context after
  })

  it('should handle multiple hunks when changes are far apart', () => {
    const lines = Array(50).fill(null).map((_, i) => `Line ${i + 1}`)
    const oldString = lines.join('\n')
    const newString = lines.map((line, i) => {
      if (i === 2) return `${line} - CHANGE 1`   // Line 3
      if (i === 25) return `${line} - CHANGE 2`  // Line 26
      if (i === 45) return `${line} - CHANGE 3`  // Line 46
      return line
    }).join('\n')
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
    
    // Should show the first hunk completely
    expect(screen.getByText(/Line 3 - CHANGE 1/)).toBeInTheDocument()
    expect(screen.getByText(/Line 1/)).toBeInTheDocument() // Context
    
    // Should indicate there are more changes (2 modifications = 4 change lines)
    expect(screen.getByText(/↓ 4 more changed lines below/)).toBeInTheDocument()
    
    // Later changes should not be visible
    expect(screen.queryByText(/Line 26 - CHANGE 2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Line 46 - CHANGE 3/)).not.toBeInTheDocument()
  })

  it('should handle edge case with no changes', () => {
    const sameContent = `Line 1
Line 2
Line 3`
    
    render(<DiffViewer oldString={sameContent} newString={sameContent} maxLines={2} />)
    
    // When there are no changes, it falls back to simple truncation
    expect(screen.getByText(/Line 1/)).toBeInTheDocument()
    expect(screen.getByText(/Line 2/)).toBeInTheDocument()
    expect(screen.queryByText(/Line 3/)).not.toBeInTheDocument()
    
    // No hidden changes indicator
    expect(screen.queryByText(/more changed line/)).not.toBeInTheDocument()
  })

  it('should handle additions at the end of file', () => {
    const oldString = `Line 1
Line 2
Line 3`
    
    const newString = `Line 1
Line 2
Line 3
Line 4 - NEW
Line 5 - NEW`
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={8} />)
    
    // Should show context before additions and the additions themselves
    expect(screen.getByText(/Line 1/)).toBeInTheDocument()
    expect(screen.getByText(/Line 4 - NEW/)).toBeInTheDocument()
    expect(screen.getByText(/Line 5 - NEW/)).toBeInTheDocument()
  })

  it('should show partial hunk when it exceeds maxLines', () => {
    const oldString = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7`
    
    const newString = `Line 1
Line 2 - MODIFIED
Line 3 - MODIFIED
Line 4 - MODIFIED
Line 5
Line 6
Line 7`
    
    render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
    
    // With maxLines=5, can only show part of the changes
    expect(screen.getByText(/Line 1/)).toBeInTheDocument() // Context before
    expect(screen.getByText(/Line 2 - MODIFIED/)).toBeInTheDocument() // First change
    
    // Should show indicator that there are more changes
    expect(screen.getByText(/↓ 2 more changed lines below/)).toBeInTheDocument()
    
    // Some changes won't be visible due to space constraints
    expect(screen.queryByText(/Line 3 - MODIFIED/)).not.toBeInTheDocument()
  })
})