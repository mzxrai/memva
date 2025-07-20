import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

// Create test images with different colors (1x1 pixel PNGs)
const testImages = [
  {
    name: 'mystery-image-1.png',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', // red
    actualColor: 'red'
  },
  {
    name: 'mystery-image-2.png', 
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // green
    actualColor: 'green'
  },
  {
    name: 'mystery-image-3.png',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA0e7HaQAAAABJRU5ErkJggg==', // blue
    actualColor: 'blue'
  }
]

// Pick a random test image
const testImage = testImages[Math.floor(Math.random() * testImages.length)]
const testImagePath = join(process.cwd(), testImage.name)
writeFileSync(testImagePath, Buffer.from(testImage.base64, 'base64'))

console.log(`Created test image at: ${testImagePath}`)
console.log(`(Actual color is ${testImage.actualColor} - let's see if Claude Code can identify it!)\n`)

async function testClaudeCodeWithImages() {
  console.log('Testing Claude Code image analysis through Read tool...\n')

  try {
    const messages: SDKMessage[] = []
    
    // Since Claude Code can use the Read tool to view images, 
    // let's ask it to analyze our test image file directly
    const prompt = `Please analyze the image at ${testImagePath} and tell me what color it is. Use your Read tool to view the image.`

    console.log('Prompt:', prompt)
    console.log('\nClaude Code response:')
    console.log('='.repeat(50))

    for await (const message of query({
      prompt,
      options: {
        maxTurns: 3, // Allow multiple turns so Claude can use Read tool
        cwd: process.cwd(),
        // Enable Read tool explicitly
        allowedTools: ['Read']
      }
    })) {
      messages.push(message)
      
      // Log different message types
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message.content
        
        // Handle different content types
        if (Array.isArray(content)) {
          for (const item of content) {
            if ('type' in item && item.type === 'text') {
              console.log('\nAssistant:', item.text)
            } else if ('type' in item && item.type === 'tool_use') {
              console.log('\nTool Use:', JSON.stringify(item, null, 2))
            }
          }
        } else {
          console.log('\nAssistant:', content)
        }
      } else if (message.type === 'result') {
        console.log('\nResult:', message)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('Test completed successfully!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    // Optional cleanup - comment out if you want to inspect the image file
    const CLEANUP = true // Set to false to keep the test image
    
    if (CLEANUP) {
      try {
        unlinkSync(testImagePath)
        console.log('Cleaned up test image.')
      } catch {}
    } else {
      console.log(`\nTest image kept at: ${testImagePath}`)
      console.log('You can inspect it manually or delete it later.')
    }
  }
}

// Alternative approach: Use streaming JSON input
async function testStreamingJsonInput() {
  console.log('\n\nTesting streaming JSON input approach...')
  console.log('='.repeat(50))
  
  // According to the docs, streaming JSON input allows sending multiple messages
  // This would be more complex to implement but might support images
  
  console.log(`
The Claude Code SDK documentation mentions streaming JSON input mode
which might support images, but it requires:

1. Using --input-format=stream-json and --output-format=stream-json
2. Sending properly formatted JSON messages via stdin
3. Each message as a complete JSON object on its own line

This would require spawning the claude binary directly rather than
using the SDK's query() function.

Example implementation would look like:
- Spawn 'claude -p --input-format=stream-json --output-format=stream-json'
- Write JSON messages to stdin
- Parse JSON responses from stdout

However, the current SDK doesn't expose this functionality directly.
`)
}

// Run tests
testClaudeCodeWithImages()
  .then(() => testStreamingJsonInput())
  .catch(console.error)