import { query, type SDKMessage } from '@anthropic-ai/claude-code'
import { join } from 'path'

async function testWithExistingImage() {
  console.log('Testing Claude Code SDK with test.jpg...\n')
  
  const imagePath = join(process.cwd(), 'test.jpg')
  console.log(`Using image: ${imagePath}`)
  
  try {
    const messages: SDKMessage[] = []
    
    // Use the exact same prompt structure that worked in CLI
    const prompt = `can you please read ${imagePath} and let me know what it shows?`
    
    console.log(`Prompt: ${prompt}`)
    console.log('\nClaude Code SDK response:')
    console.log('='.repeat(50))
    
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 3,
        cwd: process.cwd(),
        allowedTools: ['Read']
      }
    })) {
      messages.push(message)
      
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if ('type' in item && item.type === 'text') {
              console.log('\nAssistant:', item.text)
            } else if ('type' in item && item.type === 'tool_use') {
              console.log('\nTool Use:', item.name, '-', JSON.stringify(item.input))
            }
          }
        }
      } else if (message.type === 'result') {
        console.log('\nResult:', JSON.stringify(message, null, 2))
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testWithExistingImage().catch(console.error)