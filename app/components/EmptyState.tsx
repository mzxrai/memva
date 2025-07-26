import { Form } from "react-router";
import clsx from "clsx";
import { typography, transition } from "../constants/design";

type EmptyStateProps = {
  currentDirectory: string;
};

type ExamplePrompt = {
  id: string;
  text: string;
};

type PromptCategory = {
  title: string;
  description: string;
  prompts: ExamplePrompt[];
};

const promptCategories: PromptCategory[] = [
  {
    title: "Ask",
    description: "Explore and understand codebases",
    prompts: [
      { id: "ask-1", text: "Explain the overall architecture and how the main components are organized" },
      { id: "ask-2", text: "Find all API endpoints and explain what each one does" },
      { id: "ask-3", text: "How does authentication and authorization work in this codebase?" },
      { id: "ask-4", text: "What testing strategy is used and what's the current test coverage?" },
      { id: "ask-5", text: "Trace through the data flow for a typical user interaction" },
      { id: "ask-6", text: "List all external dependencies and explain why each is needed" },
      { id: "ask-7", text: "Find database models and relationships between them" },
      { id: "ask-8", text: "How are errors handled and logged throughout the application?" },
      { id: "ask-9", text: "What's the build process and deployment configuration?" },
      { id: "ask-10", text: "Explain the state management or data flow patterns being used" }
    ]
  },
  {
    title: "Brainstorm",
    description: "Ideate solutions and improvements",
    prompts: [
      { id: "brain-1", text: "How can I implement a rate limiting system to prevent API abuse?" },
      { id: "brain-2", text: "What's the best way to add real-time notifications to this application?" },
      { id: "brain-3", text: "How should I structure the database to support multi-tenancy?" },
      { id: "brain-4", text: "What caching strategy would work best for frequently accessed data?" },
      { id: "brain-5", text: "How can I implement API versioning without breaking existing clients?" },
      { id: "brain-6", text: "What's the best approach to add multi-language support to this app?" },
      { id: "brain-7", text: "How can I break up this large file into smaller, more maintainable modules?" },
      { id: "brain-8", text: "What's the most secure way to handle user authentication tokens?" },
      { id: "brain-9", text: "How should I implement comprehensive error tracking and monitoring?" },
      { id: "brain-10", text: "What's the best way to add a task queue for background job processing?" }
    ]
  },
  {
    title: "Build",
    description: "Create features and implementations",
    prompts: [
      { id: "build-1", text: "Create a drag-and-drop file upload component with progress tracking" },
      { id: "build-2", text: "Write comprehensive tests for user authentication flows" },
      { id: "build-3", text: "Implement infinite scrolling with virtualization for large datasets" },
      { id: "build-4", text: "Add a theme switcher with dark/light mode support" },
      { id: "build-5", text: "Build a webhook system for external integrations" },
      { id: "build-6", text: "Create a type-safe form validation system" },
      { id: "build-7", text: "Implement search functionality with filters and highlighting" },
      { id: "build-8", text: "Build real-time collaboration features using WebSockets" },
      { id: "build-9", text: "Create an admin dashboard with user management" },
      { id: "build-10", text: "Set up automated backups and disaster recovery" }
    ]
  }
];

function PromptButton({ prompt, currentDirectory }: { prompt: ExamplePrompt; currentDirectory: string }) {
  return (
    <Form method="post" className="w-full">
      <input type="hidden" name="title" value={prompt.text} />
      <input type="hidden" name="prompt" value={prompt.text} />
      <input type="hidden" name="project_path" value={currentDirectory} />
      
      <button
        type="submit"
        className={clsx(
          "w-full text-left p-3 rounded-md group",
          "border border-zinc-800/50",
          "bg-zinc-900/20",
          "hover:bg-zinc-900/40",
          "hover:border-zinc-700/50",
          transition.fast,
          "flex items-start justify-between gap-3"
        )}
      >
        <span className={clsx(
          "flex-1",
          "text-zinc-400 group-hover:text-zinc-300",
          typography.size.sm,
          "leading-relaxed"
        )}>
          {prompt.text}
        </span>
        <span className={clsx(
          "flex-shrink-0",
          "text-zinc-600 group-hover:text-zinc-500",
          typography.size.xs,
          "mt-0.5"
        )}>
          Try it →
        </span>
      </button>
    </Form>
  );
}

export function EmptyState({ currentDirectory }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-6xl mx-auto">
        {/* Main heading */}
        <h2 className={clsx(
          "text-3xl text-zinc-300 mb-12 text-center",
          "tracking-tight"
        )}>
          Start a new session
        </h2>

        {/* Three-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {promptCategories.map((category) => (
            <div key={category.title} className="flex flex-col">
              {/* Category header */}
              <div className="mb-4">
                <h3 className={clsx(
                  "text-lg font-medium text-zinc-300"
                )}>
                  {category.title}
                </h3>
              </div>
              
              {/* Scrollable prompt list */}
              <div className={clsx(
                "flex-1",
                "max-h-[400px] overflow-y-auto",
                "pr-2", // Padding for scrollbar
                "space-y-2",
                // Custom scrollbar styling
                "[&::-webkit-scrollbar]:w-1.5",
                "[&::-webkit-scrollbar-track]:bg-zinc-900/50",
                "[&::-webkit-scrollbar-track]:rounded-full",
                "[&::-webkit-scrollbar-thumb]:bg-zinc-700",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                "[&::-webkit-scrollbar-thumb:hover]:bg-zinc-600"
              )}>
                {category.prompts.map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    currentDirectory={currentDirectory}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Subtle hint at bottom */}
        <p className={clsx(
          "mt-12 text-center",
          "text-zinc-600",
          typography.size.sm
        )}>
          Or, type your own prompt above to get started.
        </p>
      </div>
    </div>
  );
}