import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffViewer } from '../components/events/DiffViewer'

describe('DiffViewer', () => {
  it('should render a simple diff with additions and deletions', () => {
    const oldString = 'Hello world\nThis is line 2'
    const newString = 'Hello universe\nThis is line 2\nThis is a new line'
    
    render(<DiffViewer oldString={oldString} newString={newString} />)
    
    // Should show the diff format
    expect(screen.getByText(/Hello universe/)).toBeInTheDocument()
    expect(screen.getByText(/Hello world/)).toBeInTheDocument()
    expect(screen.getByText(/This is a new line/)).toBeInTheDocument()
  })

  it('should include filename in diff header when provided', () => {
    const oldString = 'const x = 1'
    const newString = 'const x = 2'
    const fileName = 'test.js'
    
    render(<DiffViewer oldString={oldString} newString={newString} fileName={fileName} />)
    
    // Should include filename in the header
    expect(screen.getByText('test.js')).toBeInTheDocument()
  })

  it('should handle identical strings', () => {
    const sameString = 'This is the same\nNo changes here'
    
    render(<DiffViewer oldString={sameString} newString={sameString} />)
    
    // Should show unchanged lines with space prefix
    expect(screen.getByText(/This is the same/)).toBeInTheDocument()
    expect(screen.getByText(/No changes here/)).toBeInTheDocument()
  })

  it('should handle empty strings', () => {
    render(<DiffViewer oldString="" newString="New content" />)
    
    expect(screen.getByText(/New content/)).toBeInTheDocument()
  })

  it('should render diff content in a table format', () => {
    const oldString = 'line 1\nline 2'
    const newString = 'line 1\nmodified line 2'
    
    render(<DiffViewer oldString={oldString} newString={newString} />)
    
    // Should render diff content in semantic table structure
    expect(screen.getByRole('table')).toBeInTheDocument()
    
    // Should show the original and modified content
    expect(screen.getByText('line 1')).toBeInTheDocument()
    expect(screen.getByText('modified line 2')).toBeInTheDocument()
  })

  it('should handle multiline changes correctly', () => {
    const oldString = `function hello() {
  console.log("Hello world");
  return "world";
}`
    
    const newString = `function hello() {
  console.log("Hello universe");
  console.log("Extra logging");
  return "universe";
}`
    
    render(<DiffViewer oldString={oldString} newString={newString} />)
    
    // Should show the function name unchanged
    expect(screen.getByText(/function hello/)).toBeInTheDocument()
    
    // Should show the changes
    expect(screen.getByText(/Hello universe/)).toBeInTheDocument()
    expect(screen.getByText(/Hello world/)).toBeInTheDocument()
    expect(screen.getByText(/Extra logging/)).toBeInTheDocument()
  })

  it('should render diff content with proper semantic structure', () => {
    render(
      <DiffViewer 
        oldString="old content" 
        newString="new content" 
        className="custom-diff-class" 
      />
    )
    
    // Should render diff content in proper table structure
    expect(screen.getByRole('table')).toBeInTheDocument()
    
    // Should show old and new content
    expect(screen.getByText('old content')).toBeInTheDocument()
    expect(screen.getByText('new content')).toBeInTheDocument()
  })

  it('should handle complex diff scenarios with smart algorithm', () => {
    const oldString = `import React from 'react'
import { useState } from 'react'

function Component() {
  const [count, setCount] = useState(0)
  
  return <div>Count: {count}</div>
}`

    const newString = `import React from 'react'
import { useState, useEffect } from 'react'

function Component() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('test')
  
  useEffect(() => {
    console.log('Component mounted')
  }, [])
  
  return <div>Count: {count}, Name: {name}</div>
}`
    
    render(<DiffViewer oldString={oldString} newString={newString} fileName="Component.tsx" />)
    
    // Should preserve unchanged imports
    expect(screen.getByText(/import React from 'react'/)).toBeInTheDocument()
    
    // Should show the addition of useEffect import
    expect(screen.getByText(/useState, useEffect/)).toBeInTheDocument()
    
    // Should show new state variable
    expect(screen.getByText(/const \[name, setName\]/)).toBeInTheDocument()
    
    // Should show useEffect addition
    expect(screen.getByText(/useEffect\(/)).toBeInTheDocument()
  })
})