import type { Route } from "./+types/api.sessions";
import { createSession } from "../db/sessions.service";
import { updateSessionClaudeStatus } from "../db/sessions.service";
import { storeEvent, createEventFromMessage } from "../db/events.service";
import { createJob } from "../db/jobs.service";
import { createSessionRunnerJob } from "../workers/job-types";
import { formatPromptWithImages } from "../utils/image-prompt-formatting";
import { saveImageToDisk } from "../services/image-storage.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title') as string;
  const prompt = formData.get('prompt') as string;
  const projectPath = formData.get('project_path') as string;
  
  if (!title?.trim()) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }
  
  if (!prompt?.trim()) {
    return Response.json({ error: 'Prompt is required' }, { status: 400 });
  }
  
  if (!projectPath?.trim()) {
    return Response.json({ error: 'Project path is required' }, { status: 400 });
  }
  
  try {
    // Create session with claude_status set to not_started
    const session = await createSession({
      title: title.trim(),
      project_path: projectPath.trim(),
      status: 'active',
      metadata: {
        should_auto_start: true
      }
    });
    
    // Update claude_status to processing
    await updateSessionClaudeStatus(session.id, 'processing');
    
    // Handle image uploads
    const imagePaths: string[] = [];
    const imageDataEntries = [...formData.entries()].filter(([key]) => key.startsWith('image-data-'));
    
    if (imageDataEntries.length > 0) {
      for (const [key, value] of imageDataEntries) {
        const [, , index] = key.split('-');
        const fileName = formData.get(`image-name-${index}`) as string;
        const imageData = value as string;
        
        // Convert base64 to buffer
        const base64Data = imageData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Save image to disk
        const filePath = await saveImageToDisk(session.id, fileName, buffer);
        imagePaths.push(filePath);
      }
    }
    
    // Format prompt with image paths
    const finalPrompt = formatPromptWithImages(prompt.trim(), imagePaths);
    
    // Store user message as an event
    const userEvent = createEventFromMessage({
      message: {
        type: 'user',
        content: finalPrompt,
        session_id: '' // Will be populated by Claude Code SDK
      },
      memvaSessionId: session.id,
      projectPath: projectPath.trim(),
      parentUuid: null,
      timestamp: new Date().toISOString()
    });
    
    await storeEvent(userEvent);
    
    // Create session-runner job
    const jobInput = createSessionRunnerJob({
      sessionId: session.id,
      prompt: finalPrompt
    });
    
    await createJob(jobInput);
    
    return Response.json({ 
      success: true, 
      sessionId: session.id,
      redirectUrl: `/sessions/${session.id}`
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return Response.json({ 
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}