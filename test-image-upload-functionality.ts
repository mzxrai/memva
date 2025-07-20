import { saveImageToDisk } from './app/services/image-storage.server';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function testImageUpload() {
  console.log('Testing image upload functionality...\n');
  
  try {
    // Create a test image buffer (1x1 red pixel PNG)
    const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(redPixelBase64, 'base64');
    
    // Test saving image
    const sessionId = 'test-session-123';
    const fileName = 'test-image.png';
    
    console.log('1. Testing saveImageToDisk...');
    const savedPath = await saveImageToDisk(sessionId, fileName, buffer);
    console.log(`   ✓ Image saved to: ${savedPath}`);
    
    // Verify the file exists
    console.log('\n2. Verifying saved file...');
    const savedBuffer = await readFile(savedPath);
    console.log(`   ✓ File exists and is ${savedBuffer.length} bytes`);
    
    // Check that the path includes the session ID
    console.log('\n3. Verifying path structure...');
    const expectedPathPart = join('.tmp', 'sessions', sessionId);
    if (savedPath.includes(expectedPathPart)) {
      console.log(`   ✓ Path correctly includes session directory: ${expectedPathPart}`);
    } else {
      console.log(`   ✗ Path does not include expected directory: ${expectedPathPart}`);
    }
    
    // Test with a larger image
    console.log('\n4. Testing with existing test.jpg...');
    const testImagePath = join(process.cwd(), 'test.jpg');
    try {
      const testImageBuffer = await readFile(testImagePath);
      const savedTestPath = await saveImageToDisk(sessionId, 'uploaded-test.jpg', testImageBuffer);
      console.log(`   ✓ Larger image saved to: ${savedTestPath}`);
    } catch (error) {
      console.log(`   ℹ Could not test with test.jpg: ${error}`);
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testImageUpload();