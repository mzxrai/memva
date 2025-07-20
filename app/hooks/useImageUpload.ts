import { useState, useCallback } from 'react'
import type { DragEvent } from 'react'

interface UploadedImage {
  id: string
  file: File
  preview: string
}

export function useImageUpload() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    )

    const newImages = await Promise.all(
      files.map(async (file) => {
        const preview = await createImagePreview(file)
        return {
          id: generateId(),
          file,
          preview
        }
      })
    )

    setImages(prev => [...prev, ...newImages])
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }, [])

  const clearImages = useCallback(() => {
    setImages([])
  }, [])

  return {
    images,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage,
    clearImages
  }
}

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

async function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.readAsDataURL(file)
  })
}