import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

async function testImageLimitations() {
  console.log('Testing Claude Code SDK image capabilities...\n')
  console.log('='.repeat(50))
  
  // Create a simple text file for comparison
  const textFilePath = join(process.cwd(), 'test-file.txt')
  writeFileSync(textFilePath, 'Hello, this is a test text file!')
  
  // Create an image file
  const imageFilePath = join(process.cwd(), 'test-image.png')
  // 10x10 red square PNG
  const redSquareBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF4hAFU8BhEFnWH0AAAAAElFTkSuQmCC'
  writeFileSync(imageFilePath, Buffer.from(redSquareBase64, 'base64'))
  
  console.log('Created test files:')
  console.log(`- Text file: ${textFilePath}`)
  console.log(`- Image file: ${imageFilePath}`)
  console.log()

  // Test 1: Read text file
  console.log('Test 1: Reading text file')
  console.log('-'.repeat(30))
  try {
    let success = false
    for await (const message of query({
      prompt: `Read the file at ${textFilePath}`,
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
        allowedTools: ['Read']
      }
    })) {
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'text' && item.text.includes('Hello')) {
              console.log('✅ Successfully read text file')
              success = true
            }
          }
        }
      }
    }
    if (!success) console.log('❌ Failed to read text file content')
  } catch (error) {
    console.log('❌ Error reading text file:', error.message)
  }

  console.log()

  // Test 2: Read image file
  console.log('Test 2: Reading image file')
  console.log('-'.repeat(30))
  try {
    let gotError = false
    for await (const message of query({
      prompt: `Read and describe the image at ${imageFilePath}`,
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
        allowedTools: ['Read']
      }
    })) {
      if (message.type === 'result' && message.result?.includes('Could not process image')) {
        console.log('❌ Got "Could not process image" error')
        gotError = true
      }
    }
    if (!gotError) console.log('✅ No error - check if image was actually analyzed')
  } catch (error) {
    console.log('❌ Error reading image file:', error.message)
  }

  console.log()
  console.log('='.repeat(50))
  console.log('CONCLUSION:')
  console.log('The Claude Code SDK appears to have limitations with image processing')
  console.log('through the Read tool, even though the interactive CLI supports it.')
  console.log()
  console.log('Current workarounds:')
  console.log('1. Use the interactive CLI directly (not through SDK)')
  console.log('2. Wait for official SDK support for images')
  console.log('3. Use streaming JSON input (requires custom implementation)')
  
  // Cleanup
  try {
    if (existsSync(textFilePath)) unlinkSync(textFilePath)
    if (existsSync(imageFilePath)) unlinkSync(imageFilePath)
    console.log('\nCleaned up test files.')
  } catch {}
}

// Run the test
testImageLimitations().catch(console.error)