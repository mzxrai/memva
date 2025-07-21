import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useImageUpload } from '../hooks/useImageUpload'

describe('useImageUpload hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with empty images array', () => {
    const { result } = renderHook(() => useImageUpload())
    expect(result.current.images).toEqual([])
    expect(result.current.isDragging).toBe(false)
  })

  it('should handle drag over event', () => {
    const { result } = renderHook(() => useImageUpload())
    const dragEvent = new Event('dragover') as unknown as React.DragEvent
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(result.current.isDragging).toBe(true)
  })

  it('should handle drag leave event', () => {
    const { result } = renderHook(() => useImageUpload())
    const dragOverEvent = new Event('dragover') as unknown as React.DragEvent
    const dragLeaveEvent = new Event('dragleave') as unknown as React.DragEvent
    
    act(() => {
      result.current.handleDragOver(dragOverEvent)
    })
    
    expect(result.current.isDragging).toBe(true)
    
    act(() => {
      result.current.handleDragLeave(dragLeaveEvent)
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('should handle drop event with image files', async () => {
    const { result } = renderHook(() => useImageUpload())
    
    const mockImageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })
    const mockTextFile = new File(['text content'], 'test.txt', { type: 'text/plain' })
    
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [mockImageFile, mockTextFile]
      }
    } as unknown as React.DragEvent

    await act(async () => {
      await result.current.handleDrop(dropEvent)
    })

    expect(dropEvent.preventDefault).toHaveBeenCalled()
    expect(result.current.images).toHaveLength(1)
    expect(result.current.images[0]).toMatchObject({
      file: mockImageFile,
      preview: expect.any(String)
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('should remove image by id', async () => {
    const { result } = renderHook(() => useImageUpload())
    
    const mockImageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [mockImageFile]
      }
    } as unknown as React.DragEvent

    await act(async () => {
      await result.current.handleDrop(dropEvent)
    })

    const imageId = result.current.images[0].id

    act(() => {
      result.current.removeImage(imageId)
    })

    expect(result.current.images).toHaveLength(0)
  })

  it('should clear all images', async () => {
    const { result } = renderHook(() => useImageUpload())
    
    const mockImageFiles = [
      new File(['image1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['image2'], 'test2.jpg', { type: 'image/jpeg' })
    ]
    
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: mockImageFiles
      }
    } as unknown as React.DragEvent

    await act(async () => {
      await result.current.handleDrop(dropEvent)
    })

    expect(result.current.images).toHaveLength(2)

    act(() => {
      result.current.clearImages()
    })

    expect(result.current.images).toHaveLength(0)
  })

  it('should only accept image files', async () => {
    const { result } = renderHook(() => useImageUpload())
    
    const files = [
      new File(['image'], 'test.jpg', { type: 'image/jpeg' }),
      new File(['image'], 'test.png', { type: 'image/png' }),
      new File(['image'], 'test.gif', { type: 'image/gif' }),
      new File(['text'], 'test.txt', { type: 'text/plain' }),
      new File(['pdf'], 'test.pdf', { type: 'application/pdf' })
    ]
    
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { files }
    } as unknown as React.DragEvent

    await act(async () => {
      await result.current.handleDrop(dropEvent)
    })

    expect(result.current.images).toHaveLength(3)
    expect(result.current.images.every(img => img.file.type.startsWith('image/'))).toBe(true)
  })
})