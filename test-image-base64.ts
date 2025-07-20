import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { readFileSync } from 'fs'
import { join } from 'path'

async function testBase64ImageInPrompt() {
  console.log('Testing Claude Code SDK with base64 image in prompt...\n')
  
  const imagePath = join(process.cwd(), 'test.jpg')
  
  try {
    // Read the image and convert to base64
    const imageBuffer = readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    
    console.log(`Image size: ${imageBuffer.length} bytes`)
    console.log(`Base64 length: ${base64Image.length} characters`)
    console.log(`First 100 chars of base64: ${base64Image.substring(0, 100)}...`)
    
    const messages: SDKMessage[] = []
    
    // Try different approaches
    console.log('\n\nTest 1: Base64 string directly')
    console.log('='.repeat(50))
    
    const prompt1 = `I have a base64-encoded image. Can you decode and analyze it? Here it is:\n\n${base64Image}`
    
    for await (const message of query({
      prompt: prompt1,
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
      }
    })) {
      messages.push(message)
      
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if ('type' in item && item.type === 'text') {
              // Only show first 500 chars to avoid spam
              const text = item.text.length > 500 ? item.text.substring(0, 500) + '...' : item.text
              console.log('\nAssistant:', text)
            }
          }
        }
      } else if (message.type === 'result') {
        console.log('\nResult:', message.subtype, '- Cost:', message.total_cost_usd)
      }
    }
    
    // Test 2: Data URL format
    console.log('\n\nTest 2: Data URL format')
    console.log('='.repeat(50))
    
    const prompt2 = `Can you analyze this image? ![image](data:image/jpeg;base64,${base64Image})`
    
    for await (const message of query({
      prompt: prompt2,
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
      }
    })) {
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if ('type' in item && item.type === 'text') {
              const text = item.text.length > 500 ? item.text.substring(0, 500) + '...' : item.text
              console.log('\nAssistant:', text)
            }
          }
        }
      } else if (message.type === 'result') {
        console.log('\nResult:', message.subtype, '- Cost:', message.total_cost_usd)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testBase64ImageInPrompt().catch(console.error)