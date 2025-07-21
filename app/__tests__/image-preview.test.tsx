import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImagePreview } from '../components/ImagePreview'
import { expectInteraction } from '../test-utils/component-testing'

describe('ImagePreview Component', () => {
  const mockImages = [
    {
      id: 'img-1',
      file: new File(['image1'], 'test1.jpg', { type: 'image/jpeg' }),
      preview: 'data:image/jpeg;base64,test1'
    },
    {
      id: 'img-2',
      file: new File(['image2'], 'test2.png', { type: 'image/png' }),
      preview: 'data:image/png;base64,test2'
    }
  ]

  const mockOnRemove = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render nothing when no images provided', () => {
    const { container } = render(
      <ImagePreview images={[]} onRemove={mockOnRemove} />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should render image previews', () => {
    render(
      <ImagePreview images={mockImages} onRemove={mockOnRemove} />
    )
    
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    
    expect(images[0]).toHaveAttribute('src', mockImages[0].preview)
    expect(images[0]).toHaveAttribute('alt', mockImages[0].file.name)
    
    expect(images[1]).toHaveAttribute('src', mockImages[1].preview)
    expect(images[1]).toHaveAttribute('alt', mockImages[1].file.name)
  })

  it('should render remove buttons for each image', () => {
    render(
      <ImagePreview images={mockImages} onRemove={mockOnRemove} />
    )
    
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    expect(removeButtons).toHaveLength(2)
    
    removeButtons.forEach(button => {
      expectInteraction.clickable(button)
    })
  })

  it('should call onRemove when remove button is clicked', () => {
    render(
      <ImagePreview images={mockImages} onRemove={mockOnRemove} />
    )
    
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    
    fireEvent.click(removeButtons[0])
    expect(mockOnRemove).toHaveBeenCalledWith(mockImages[0].id)
    
    fireEvent.click(removeButtons[1])
    expect(mockOnRemove).toHaveBeenCalledWith(mockImages[1].id)
  })

  it('should display file names', () => {
    render(
      <ImagePreview images={mockImages} onRemove={mockOnRemove} />
    )
    
    expect(screen.getByText('test1.jpg')).toBeInTheDocument()
    expect(screen.getByText('test2.png')).toBeInTheDocument()
  })

  it('should have appropriate accessibility attributes', () => {
    render(
      <ImagePreview images={mockImages} onRemove={mockOnRemove} />
    )
    
    const container = screen.getByRole('region', { name: /image previews/i })
    expect(container).toBeInTheDocument()
    
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    removeButtons.forEach((button, index) => {
      expect(button).toHaveAttribute('aria-label', `Remove ${mockImages[index].file.name}`)
    })
  })
})