# Event Rendering System Redesign Plan

## Executive Summary (Updated 2025-07-14)

**Goal**: Transform the colorful, playful design into a sophisticated, Linear-inspired interface.

**Progress**: ~75% Complete
- ✅ Created comprehensive design system (colors, typography, spacing)
- ✅ Built reusable components (MessageContainer, MessageHeader, CodeBlock, ToolCallDisplay)
- ✅ Redesigned all event components to use shared architecture
- ✅ Added View Raw/Rendered toggle for debugging
- ✅ Enhanced tool call readability with primary parameter display
- ✅ All tests passing (129 tests), linting clean, TypeScript strict

**Remaining Work**:
- Tool result display component
- Visual polish (shadows, animations)
- Tool call/result pairing
- Copy functionality for text

## Overview
Transforming the current colorful, playful design into a sophisticated, Linear-inspired interface that's perfect for developers. Focus on minimal black/white aesthetic with subtle accents, better typography, and enhanced functionality.

## Phase 1: Foundation & Typography

- [x] **Load JetBrains Mono Font**
  - Added JetBrains Mono Google Font link to root.tsx
  - Font weights 100-800 with italic support
  - Already configured in app.css but wasn't loaded

- [x] **Create Design System Constants**
  - Created `app/constants/design.ts` with comprehensive design tokens
  - Color palette: Primarily grayscale (zinc scale) with subtle accent colors
  - Typography system with consistent sizing and weights
  - Spacing scale based on 4px increments
  - Subtle shadows and transitions (150-300ms)
  - Interactive states and focus styles
  - **Realization**: Consistent design tokens make the entire system more maintainable

## Phase 2: Enhanced Base Components

- [x] **Write Tests for CodeBlock Component**
  - Test syntax highlighting functionality ✓
  - Test copy button behavior ✓
  - Test different language support ✓
  - Test long code handling ✓
  - Added diff mode tests for GitHub-style diffs ✓
  - **Realization**: TDD helped ensure all features work correctly from the start

- [x] **Implement CodeBlock Component**
  - Clean code display with proper monospace font (JetBrains Mono) ✓
  - Copy-to-clipboard with check icon feedback ✓
  - Language indicator badge (subtle, top-right) ✓
  - Line numbers with proper gutter ✓
  - Support for diff display (GitHub-inspired) ✓
  - Plus/minus indicators in gutter with red/green coloring ✓
  - Proper spacing and typography ✓
  - Subtle border and background treatment ✓
  - **Realization**: GitHub's diff viewer is the gold standard - used subtle red/green backgrounds
  - **Note**: Chose simple line-by-line diff rendering over complex syntax highlighting for now

- [x] **Write Tests for ToolCallDisplay Component**
  - Test tool icon rendering ✓
  - Test parameter display ✓
  - Test collapse/expand functionality ✓
  - Test different tool types ✓
  - Added test for result indicator ✓

- [x] **Implement ToolCallDisplay Component**
  - Clean tool call visualization ✓
  - Icons for different tool types (mapped 10+ tools) ✓
  - Collapsible parameter display using CodeBlock ✓
  - Tool ID badges for pairing ✓
  - Result indicator when tool has result ✓
  - **Realization**: Reusing CodeBlock for JSON display maintains consistency
  - **Note**: Minimal design with subtle hover effects keeps focus on content

- [ ] **Write Tests for ToolResultDisplay Component**
  - Test different result types (file, bash, search, etc.)
  - Test error state rendering
  - Test large content handling
  - Test tool_use_id linking

- [ ] **Implement ToolResultDisplay Component**
  - Formatted tool results by type
  - Error/success indicators
  - Collapsible for large outputs
  - Visual link to tool call

- [x] **Write Tests for MessageContainer Component**
  - Test default styling application ✓
  - Test custom className merging ✓
  - Test children rendering ✓
  - All tests passing ✓

- [x] **Create MessageContainer Component**
  - Base container with consistent styling for all messages ✓
  - Grey background (colors.background.secondary) ✓
  - Subtle border and large border radius ✓
  - Standard padding (p-4) ✓
  - Accepts children for flexible content ✓
  - Custom className support for variations ✓

- [x] **Write Tests for MessageHeader Component**
  - Test icon and title rendering ✓
  - Test optional children support ✓
  - Test layout consistency ✓
  - All tests passing ✓

- [x] **Create MessageHeader Component**
  - Standardized header for all message types ✓
  - Props: icon (React Icon), title (string), children (optional) ✓
  - Consistent layout and typography ✓
  - Support for additional elements (badges, buttons) ✓
  - Eliminates duplicate header code across components ✓

## Phase 3: Redesign Event Components

- [x] **Redesign BaseEventWrapper**
  - Remove hover-only metadata display ✓
  - Add "View Raw" button for viewing event JSON ✓
  - Toggle between rendered view and raw JSON ✓
  - SVG icons for view modes (eye/code icons) ✓
  - Positioned in bottom-right corner ✓
  - Proper z-index for overlay positioning ✓

- [x] **Update UserMessageEvent**
  - Using shared MessageContainer and MessageHeader ✓
  - Removed duplicate styling code ✓
  - Proper icon (RiUser3Line) instead of colored dot ✓
  - Consistent monospace font for content ✓

- [x] **Redesign AssistantMessageEvent**
  - Replace emoji with react-icons (RiSparklingLine) ✓
  - Use ToolCallDisplay for tool_use content type ✓
  - Thinking blocks with collapsible details element ✓
  - Brain icon (RiBrainLine) for thinking indicator ✓
  - Using shared MessageContainer and MessageHeader ✓
  - Proper content type handling (text, tool_use, thinking) ✓
  - Fallback to CodeBlock for unknown content types ✓

- [ ] **Create ResultEvent Component**
  - Dedicated component for completion events
  - Success/completion indicators
  - Summary display
  - Clear visual distinction

- [x] **Update System & Error Events**
  - SystemEvent: Uses shared components, hides "init" subtype, shows "result" for success ✓
  - ErrorEvent: Uses shared components with color variations for error/cancelled ✓
  - FallbackEvent: Uses shared components for unknown event types ✓
  - All events now consistent with design system ✓

## Phase 4: Visual Polish

- [ ] **Implement Subtle Shadows and Depth**
  - 0-1px shadows for cards
  - Subtle elevation on hover
  - Proper layering and z-index

- [ ] **Add Interactive Features**
  - Copy buttons for code/text
  - Expand/collapse animations
  - Smooth scroll-to-message
  - Keyboard navigation

- [ ] **Tool Call/Result Pairing**
  - Visual connection between calls and results
  - ID-based linking system
  - Jump-to functionality
  - Combined view option

## Phase 5: Testing & Refinement

- [x] **Run Linter**
  - Fixed all ESLint issues ✓
  - Removed unused imports ✓
  - Consistent code style throughout ✓

- [x] **TypeScript Type Checking**
  - All types are correct ✓
  - Replaced `any` with `unknown` where needed ✓
  - Proper type exports ✓

- [x] **Run All Tests**
  - All 129 tests passing ✓
  - Updated tests to match new UI ✓
  - New component tests (MessageContainer, MessageHeader) passing ✓

- [ ] **Performance Optimization**
  - Proper memoization
  - Lazy loading for large content
  - Virtualization consideration

## Notes & Realizations

### Design System (Completed)
- Created a comprehensive design token system that mirrors Linear's aesthetic
- Used zinc color scale for primary UI (950-500 range)
- Minimal use of color - only for semantic meaning (errors, success, etc.)
- Consistent spacing based on 4px grid (Tailwind's default)
- Subtle transitions (150ms) for snappy feel

### Component Architecture (Completed)
- Successfully eliminated all duplicate styling code
- MessageContainer provides consistent base styling for all message types
- MessageHeader standardizes the icon/title pattern across all messages
- All message types now share the same visual foundation
- Tests ensure components work correctly and maintain consistency

### UI Improvements (Completed)
- Removed emoji usage in favor of professional react-icons
- Tool calls now show meaningful primary parameters instead of IDs
- Added "View Raw" functionality to all events for debugging
- System messages properly styled and filtered (init hidden, success shows result)
- Error messages have distinct visual treatment while maintaining consistency
- Added vertical spacing between header and messages for better visual hierarchy

## Additional Features Implemented (Not in Original Plan)

- [x] **View Raw/Rendered Toggle**
  - Added to BaseEventWrapper for all event types
  - Toggle button in bottom-right corner with SVG icons
  - Shows formatted JSON using CodeBlock component
  - Helps with debugging and understanding event structure

- [x] **Enhanced ToolCallDisplay**
  - Shows primary parameter value instead of just tool ID
  - Smart parameter extraction (e.g., file_path, command, query)
  - Makes tool calls more readable at a glance
  - Falls back to showing ID if no primary parameter found

- [x] **System Message Filtering**
  - Automatically hides "init" subtype system messages
  - Shows "success" subtype with result content
  - Reduces noise in the event stream

## Current Status

### What's Complete (~75%)
- ✅ Foundation & typography system
- ✅ Base component architecture (MessageContainer, MessageHeader)
- ✅ CodeBlock with syntax highlighting and diff support
- ✅ ToolCallDisplay with collapsible parameters
- ✅ All event components updated to use shared styling
- ✅ View Raw/Rendered toggle functionality
- ✅ Enhanced parameter display in tool calls
- ✅ System message filtering
- ✅ Tests passing (129 tests) and linting clean
- ✅ TypeScript strict mode compliance

### What's Missing (~25%)
- ❌ **ToolResultDisplay Component** - Tool results not shown inline with calls
- ❌ **ResultEvent Component** - No special handling for completion events
- ❌ **Visual Polish** - No shadows, elevation effects, or animations
- ❌ **Interactive Features** - Missing copy buttons for text, keyboard shortcuts
- ❌ **Tool Call/Result Pairing** - No visual connection between calls and results
- ❌ **Performance Optimization** - No lazy loading or virtualization

### Next Priority Tasks
1. Implement ToolResultDisplay to show tool results properly
2. Create visual pairing between tool calls and their results
3. Add copy functionality to message text
4. Implement subtle shadows and hover effects for polish