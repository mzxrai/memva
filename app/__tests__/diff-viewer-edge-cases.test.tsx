import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffViewer } from '../components/events/DiffViewer'

describe('DiffViewer Edge Cases', () => {
  describe('Single line changes', () => {
    it('should handle single line change at beginning', () => {
      const oldString = `First line
Second line
Third line
Fourth line
Fifth line`
      
      const newString = `First line - MODIFIED
Second line
Third line
Fourth line
Fifth line`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show the change with context
      expect(screen.getByText(/First line - MODIFIED/)).toBeInTheDocument()
      expect(screen.getByText(/Second line/)).toBeInTheDocument()
      expect(screen.getByText(/Third line/)).toBeInTheDocument()
    })

    it('should handle single line change at end', () => {
      const lines = Array(20).fill(null).map((_, i) => `Line ${i + 1}`)
      const oldString = lines.join('\n')
      const newString = lines.map((line, i) => {
        if (i === 19) return `${line} - MODIFIED`  // Last line
        return line
      }).join('\n')
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
      
      // Should show the last change with context
      expect(screen.getByText(/Line 20 - MODIFIED/)).toBeInTheDocument()
      expect(screen.getByText(/Line 17/)).toBeInTheDocument() // 3 lines context before
      expect(screen.getByText(/Line 18/)).toBeInTheDocument()
      expect(screen.getByText(/Line 19/)).toBeInTheDocument()
    })

    it('should handle single character change', () => {
      const oldString = `const x = 1;`
      const newString = `const x = 2;`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show both versions
      expect(screen.getByText(/const x = 1;/)).toBeInTheDocument()
      expect(screen.getByText(/const x = 2;/)).toBeInTheDocument()
    })
  })

  describe('File boundary changes', () => {
    it('should handle change on first line with no context before', () => {
      const oldString = `First line
Second line
Third line`
      
      const newString = `First line - MODIFIED
Second line
Third line`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show change even without context before
      expect(screen.getByText(/First line - MODIFIED/)).toBeInTheDocument()
      expect(screen.getByText(/Second line/)).toBeInTheDocument()
    })

    it('should handle change on last line with no context after', () => {
      const oldString = `First line
Second line
Last line`
      
      const newString = `First line
Second line
Last line - MODIFIED`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show change with available context
      expect(screen.getByText(/First line/)).toBeInTheDocument() // Context before
      expect(screen.getByText(/Last line - MODIFIED/)).toBeInTheDocument()
    })

    it('should handle entire file replacement', () => {
      const oldString = `Old content line 1
Old content line 2
Old content line 3`
      
      const newString = `New content line 1
New content line 2
New content line 3`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={6} />)
      
      // Should show both old and new content (up to limit)
      expect(screen.getByText(/Old content line 1/)).toBeInTheDocument()
      expect(screen.getByText(/New content line 1/)).toBeInTheDocument()
    })
  })

  describe('Empty file handling', () => {
    it('should handle empty old file', () => {
      const oldString = ''
      const newString = `New line 1
New line 2
New line 3`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show all additions
      expect(screen.getByText(/New line 1/)).toBeInTheDocument()
      expect(screen.getByText(/New line 2/)).toBeInTheDocument()
      expect(screen.getByText(/New line 3/)).toBeInTheDocument()
    })

    it('should handle empty new file', () => {
      const oldString = `Old line 1
Old line 2
Old line 3`
      const newString = ''
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show all deletions
      expect(screen.getByText(/Old line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Old line 2/)).toBeInTheDocument()
      expect(screen.getByText(/Old line 3/)).toBeInTheDocument()
    })

    it('should handle both files empty', () => {
      render(<DiffViewer oldString="" newString="" maxLines={5} />)
      
      // Should render without errors
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Large files with scattered changes', () => {
    it('should prioritize showing earlier changes in very large files', () => {
      const lines = Array(1000).fill(null).map((_, i) => `Line ${i + 1}`)
      const oldString = lines.join('\n')
      const newString = lines.map((line, i) => {
        if (i === 10) return `${line} - CHANGE 1`    // Line 11
        if (i === 100) return `${line} - CHANGE 2`   // Line 101
        if (i === 500) return `${line} - CHANGE 3`   // Line 501
        if (i === 900) return `${line} - CHANGE 4`   // Line 901
        return line
      }).join('\n')
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
      
      // Should show first change with context
      expect(screen.getByText(/Line 11 - CHANGE 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 8/)).toBeInTheDocument() // Context before
      
      // Should indicate many more changes
      expect(screen.getByText(/↓ 6 more changed lines below/)).toBeInTheDocument()
      
      // Later changes should not be visible
      expect(screen.queryByText(/CHANGE 2/)).not.toBeInTheDocument()
      expect(screen.queryByText(/CHANGE 3/)).not.toBeInTheDocument()
      expect(screen.queryByText(/CHANGE 4/)).not.toBeInTheDocument()
    })

    it('should handle file with only changes and no unchanged lines', () => {
      const oldString = `A\nB\nC\nD\nE`
      const newString = `1\n2\n3\n4\n5`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show first few changes
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      
      // Should show indicator for more changes
      expect(screen.getByText(/more changed lines below/)).toBeInTheDocument()
    })
  })

  describe('Adjacent hunks merging', () => {
    it('should merge changes within 3 lines of each other', () => {
      const oldString = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8`
      
      const newString = `Line 1
Line 2 - MODIFIED
Line 3
Line 4
Line 5 - MODIFIED
Line 6
Line 7
Line 8`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={12} />)
      
      // Both changes should be visible in one hunk (gap is only 2 unchanged lines)
      expect(screen.getByText(/Line 2 - MODIFIED/)).toBeInTheDocument()
      expect(screen.getByText(/Line 5 - MODIFIED/)).toBeInTheDocument()
      
      // Should include all lines between as they're part of the merged hunk
      expect(screen.getByText(/Line 3/)).toBeInTheDocument()
      expect(screen.getByText(/Line 4/)).toBeInTheDocument()
    })

    it('should not merge changes more than 6 lines apart', () => {
      const oldString = Array(20).fill(null).map((_, i) => `Line ${i + 1}`).join('\n')
      const newString = Array(20).fill(null).map((_, i) => {
        if (i === 2) return `Line ${i + 1} - CHANGE 1`   // Line 3
        if (i === 12) return `Line ${i + 1} - CHANGE 2`  // Line 13  (10 lines apart)
        return `Line ${i + 1}`
      }).join('\n')
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
      
      // Should only show first hunk
      expect(screen.getByText(/Line 3 - CHANGE 1/)).toBeInTheDocument()
      
      // Second change should not be visible (separate hunk)
      expect(screen.queryByText(/Line 13 - CHANGE 2/)).not.toBeInTheDocument()
      
      // Should indicate more changes
      expect(screen.getByText(/↓ 2 more changed lines below/)).toBeInTheDocument()
    })
  })

  describe('Special content handling', () => {
    it('should handle lines with only whitespace', () => {
      const oldString = `Line 1
    
Line 3`
      
      const newString = `Line 1
        
Line 3`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
      
      // Should show the whitespace change
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 3/)).toBeInTheDocument()
      // The whitespace line will be rendered but might be hard to test for
    })

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(200)
      const oldString = `Short line\n${longLine}\nAnother line`
      const newString = `Short line\n${longLine}MODIFIED\nAnother line`
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={10} />)
      
      // Should show the change
      expect(screen.getByText(/Short line/)).toBeInTheDocument()
      expect(screen.getByText(/MODIFIED/)).toBeInTheDocument()
    })

    it('should handle files with no newline at end', () => {
      const oldString = 'Single line without newline'
      const newString = 'Single line without newline - MODIFIED'
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={5} />)
      
      // Should show both versions
      expect(screen.getByText(/Single line without newline$/)).toBeInTheDocument()
      expect(screen.getByText(/Single line without newline - MODIFIED/)).toBeInTheDocument()
    })
  })

  describe('Performance edge cases', () => {
    it('should handle maxLines of 0', () => {
      const oldString = 'Line 1\nLine 2'
      const newString = 'Line 1\nLine 2 - MODIFIED'
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={0} />)
      
      // Should show all content when maxLines is 0
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 2 - MODIFIED/)).toBeInTheDocument()
    })

    it('should handle undefined maxLines', () => {
      const oldString = 'Line 1\nLine 2'
      const newString = 'Line 1\nLine 2 - MODIFIED'
      
      render(<DiffViewer oldString={oldString} newString={newString} />)
      
      // Should show all content when maxLines is undefined
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 2 - MODIFIED/)).toBeInTheDocument()
    })

    it('should handle maxLines larger than content', () => {
      const oldString = 'Line 1\nLine 2'
      const newString = 'Line 1\nLine 2 - MODIFIED'
      
      render(<DiffViewer oldString={oldString} newString={newString} maxLines={100} />)
      
      // Should show all content
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 2 - MODIFIED/)).toBeInTheDocument()
      
      // No hidden changes indicator
      expect(screen.queryByText(/more changed lines below/)).not.toBeInTheDocument()
    })
  })
})