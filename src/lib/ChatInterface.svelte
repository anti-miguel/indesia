<script>
  import {
    onMount,
    onDestroy,
    afterUpdate,
    createEventDispatcher,
  } from "svelte";
  import {
    chatMessages,
    chatInputValue,
    currentDocumentData,
    analysisResults,
    validationResults,
    extractedElements,
    aiProcessing,
    aiServiceInstance,
    aiModel,
  } from "./stores.js";
  import { addChatMessage, clearChat, showNotification } from "./stores.js";
  import { documentService } from "./services/documentService.js";
  import { geminiValidatorService } from "./services/geminiValidatorService.js";
  import {
    Send,
    Trash2,
    FileText,
    Image as ImageIcon,
    Download,
    Copy,
    CheckCircle,
    AlertTriangle,
    Info,
    Settings,
    Eye,
    X,
  } from "lucide-svelte";
  import { formatDistanceToNow } from "date-fns";

  const dispatch = createEventDispatcher();

  let chatContainer;
  let messageInput;
  let autoScroll = true;
  let isTyping = false;
  let typewriterInterval;
  let showGeminiSettings = false;
  let geminiApiKey = "";

  // Typewriter effect state
  let currentlyTyping = false;
  let typewriterMessages = new Map(); // Map message ID to typewriter state

  $: document = $currentDocumentData;
  $: analysis = document ? $analysisResults[document.id] : null;
  $: validation = document ? $validationResults[document.id] : null;
  $: elements = document ? $extractedElements[document.id] : null;

  onMount(() => {
    // Add welcome message if no messages exist - ensure it's added to store
    if ($chatMessages.length === 0) {
      console.log("Adding welcome message to empty chat");
      addWelcomeMessage();
    } else {
      console.log("Chat messages already exist:", $chatMessages.length);
    }

    // Focus input with a small delay
    setTimeout(() => {
      messageInput?.focus();
    }, 100);

    // Check if Gemini service is available
    if (!geminiValidatorService.isAvailable()) {
      geminiApiKey = localStorage.getItem("gemini_api_key") || "";
    }

    // Debug: Log chat messages periodically
    const debugInterval = setInterval(() => {
      console.log("Current chat messages count:", $chatMessages.length);
      if ($chatMessages.length > 0) {
        console.log("Last message:", $chatMessages[$chatMessages.length - 1]);
      }
    }, 5000);

    // Clean up debug interval after 30 seconds
    setTimeout(() => clearInterval(debugInterval), 30000);
  });

  onDestroy(() => {
    // Clean up all typewriter intervals
    typewriterMessages.forEach((state) => {
      if (state.interval) {
        clearInterval(state.interval);
      }
    });
    typewriterMessages.clear();
  });

  afterUpdate(() => {
    if (autoScroll && chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });

  function addWelcomeMessage() {
    let welcomeText = `Hello! I'm your AI assistant for P&ID analysis. I can help you understand your drawings, identify equipment, validate designs, and answer questions about your blueprints.

Upload a document and start asking questions!`;

    // Check if services are available
    try {
      if (geminiValidatorService?.isAvailable()) {
        welcomeText = `Hello! I'm your AI assistant for P&ID analysis. I can help you understand your drawings, identify equipment, validate designs, and answer questions about your blueprints.

✅ Enhanced validation with Gemini AI is available!

Upload a document and start asking questions!`;
      } else {
        welcomeText = `Hello! I'm your AI assistant for P&ID analysis. I can help you understand your drawings, identify equipment, validate designs, and answer questions about your blueprints.

⚙️ Configure Gemini API for enhanced validation features.

Upload a document and start asking questions!`;
      }
    } catch (serviceError) {
      console.warn(
        "Service check failed, using basic welcome message:",
        serviceError,
      );
      // Use the basic welcome message defined above
    }

    // Ensure the message gets added properly
    const welcomeMessage = {
      type: "ai",
      content: welcomeText,
      metadata: { type: "welcome" },
      id: "welcome-" + Date.now(),
      timestamp: new Date(),
    };

    console.log("Adding welcome message:", welcomeMessage);

    // Add directly to store first
    addChatMessage(welcomeMessage);

    // Verify it was added
    setTimeout(() => {
      console.log("Messages after welcome add:", $chatMessages.length);
      if ($chatMessages.length === 0) {
        console.error(
          "Welcome message failed to add, trying direct store update",
        );
        // Fallback: update store directly
        chatMessages.update((messages) => [...messages, welcomeMessage]);
      }
    }, 100);
  }

  function addChatMessageWithTypewriter(message) {
    if (
      message.type === "ai" &&
      message.content &&
      message.content.length > 0
    ) {
      // Add message with empty content first for typewriter effect
      const messageWithEmptyContent = {
        ...message,
        content: "", // Start empty for typewriter
        id: Date.now() + Math.random(),
        originalContent: message.content, // Store original content
      };

      addChatMessage(messageWithEmptyContent);

      // Start typewriter effect with original content
      startTypewriterEffect(message.content, messageWithEmptyContent.id);
    } else {
      // User messages or messages without content don't need typewriter effect
      const messageWithId = {
        ...message,
        id: message.id || Date.now() + Math.random(),
        content: message.content || "Message content missing",
      };
      addChatMessage(messageWithId);
    }
  }

  function startTypewriterEffect(targetContent, messageId) {
    const typewriterSpeed = 25; // milliseconds per character
    let currentContent = "";
    let charIndex = 0;

    const typewriterState = {
      interval: null,
      complete: false,
    };

    typewriterMessages.set(messageId, typewriterState);

    const typeNextChar = () => {
      if (charIndex < targetContent.length) {
        currentContent += targetContent.charAt(charIndex);
        charIndex++;

        // Update the message content in the store
        chatMessages.update((messages) =>
          messages.map((msg) =>
            msg.id === messageId ? { ...msg, content: currentContent } : msg,
          ),
        );

        // Schedule next character
        typewriterState.interval = setTimeout(typeNextChar, typewriterSpeed);
      } else {
        // Typewriter effect complete
        typewriterState.complete = true;
        typewriterMessages.delete(messageId);
      }
    };

    // Start typing
    typeNextChar();
  }

  async function handleSendMessage() {
    const message = $chatInputValue.trim();
    if (!message || $aiProcessing || currentlyTyping) return;

    // Add user message
    addChatMessage({
      type: "user",
      content: message,
    });

    // Clear input
    chatInputValue.set("");
    isTyping = true;
    currentlyTyping = true;

    try {
      // Create context for AI
      const context = createMessageContext();

      // Generate AI response if service is available
      let response =
        "I apologize, but I'm having trouble connecting to the AI service right now. Let me try to help you with basic P&ID questions anyway.";

      if ($aiServiceInstance) {
        try {
          response = await $aiServiceInstance.generateChatResponse(
            message,
            context,
          );
        } catch (aiError) {
          console.warn("AI service error, using fallback:", aiError);
          response = getFallbackResponse(message, context);
        }
      } else {
        // Try to provide basic help without AI service
        response = getFallbackResponse(message, context);
      }

      // Add AI response with typewriter effect
      addChatMessageWithTypewriter({
        type: "ai",
        content: response,
        metadata: {
          context: context.hasDocument ? "document" : "general",
          documentId: document?.id,
        },
      });

      // Check if user is asking about specific elements
      await handleSpecialQueries(message, response);
    } catch (error) {
      console.error("Failed to get AI response:", error);
      addChatMessageWithTypewriter({
        type: "ai",
        content:
          "I apologize, but I'm having trouble processing your request right now. You can still upload and analyze P&ID documents, and I'll try to help with any questions you have.",
        metadata: { type: "error" },
      });
    } finally {
      isTyping = false;
      currentlyTyping = false;
    }
  }

  function getFallbackResponse(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
      return "Hello! I'm here to help you analyze P&ID drawings. Upload a document to get started, and I'll do my best to answer your questions about it.";
    }

    if (lowerMessage.includes("help")) {
      if (context.hasDocument) {
        return "I can help you understand this P&ID drawing. Try asking about specific equipment, instruments, or validation checks.";
      }
      return "Upload a P&ID document (PDF or image) and I'll help you analyze it. I can identify equipment, instruments, piping, and check for potential issues.";
    }

    if (context.hasDocument) {
      return "I can see you have a document uploaded. While I'm having some technical difficulties, you can still run analysis on your P&ID and browse the results. Try asking specific questions about equipment or instrumentation.";
    }

    return "I'm currently having some technical difficulties, but I can still try to help. Please upload a P&ID document and I'll do my best to assist with your analysis.";
  }

  async function configureGeminiApi() {
    if (!geminiApiKey.trim()) {
      showNotification("Please enter a valid API key", "warning");
      return;
    }

    try {
      const success = await geminiValidatorService.setApiKey(
        geminiApiKey.trim(),
      );

      if (success) {
        showNotification("Gemini API configured successfully!", "success");
        showGeminiSettings = false;

        // Add a message about the new capability
        addChatMessageWithTypewriter({
          type: "ai",
          content:
            "🎉 Gemini AI validation is now active! I can now perform advanced P&ID comparison analysis and detect color markups in your drawings. Upload two versions of a P&ID to compare them.",
          metadata: { type: "system" },
        });
      } else {
        showNotification(
          "Failed to configure Gemini API. Please check your key.",
          "error",
        );
      }
    } catch (error) {
      console.error("Gemini configuration error:", error);
      showNotification(
        "Error configuring Gemini API: " + error.message,
        "error",
      );
    }
  }

  function createMessageContext() {
    const context = {
      hasDocument: !!document,
      document: document?.name,
      analyzed: document?.analyzed || false,
      geminiAvailable: geminiValidatorService.isAvailable(),
    };

    if (document) {
      context.documentType = document.type;

      if (analysis) {
        context.equipment = analysis.text?.entities?.equipment || [];
        context.instruments = analysis.text?.entities?.instruments || [];
        context.validation = validation;
      } else if (elements) {
        // Fallback to extracted elements if full analysis isn't available
        context.equipment = elements.equipment || [];
        context.instruments = elements.instruments || [];
        context.piping = elements.piping || [];
      }

      // If analyzed but no equipment found, try to infer from text or provide generic "detected" flag
      // This prevents the "please upload document" response when analysis is actually done
      if (
        context.analyzed &&
        (!context.equipment || context.equipment.length === 0)
      ) {
        // Check if we have raw text to hint at content
        if (document.text && document.text.length > 100) {
          // Minimal fallback to say we have content
          context.hasContent = true;
        }
      }
    }

    return context;
  }

  async function handleSpecialQueries(userMessage, aiResponse) {
    const message = userMessage.toLowerCase();

    // Check for requests for equipment lists
    if (message.includes("equipment") && message.includes("list")) {
      await sendEquipmentSummary();
    }

    // Check for validation requests
    if (
      message.includes("valid") ||
      message.includes("check") ||
      message.includes("issue")
    ) {
      await sendValidationSummary();
    }

    // Check for instrument queries
    if (message.includes("instrument") && elements?.instruments?.length > 0) {
      await sendInstrumentSummary();
    }

    // Check for comparison requests
    if (message.includes("compare") && geminiValidatorService.isAvailable()) {
      addChatMessageWithTypewriter({
        type: "ai",
        content:
          "To perform P&ID comparison with color markup detection, please upload both the master drawing (with colored markups) and the draft drawing (revised version) using the dual upload feature.",
        metadata: { type: "comparison_help" },
      });
    }
  }

  async function sendEquipmentSummary() {
    if (!analysis?.equipment) return;

    const equipmentList = Object.entries(analysis.equipment)
      .filter(([key, value]) => Array.isArray(value) && value.length > 0)
      .map(
        ([type, items]) =>
          `**${type.charAt(0).toUpperCase() + type.slice(1)}**: ${items.join(", ")}`,
      )
      .join("\n");

    if (equipmentList) {
      addChatMessageWithTypewriter({
        type: "ai",
        content: `Here's a summary of the equipment I found in the drawing:\n\n${equipmentList}`,
        metadata: {
          type: "equipment_summary",
          snippet: true,
        },
      });
    }
  }

  async function sendValidationSummary() {
    if (!validation) return;

    let content = `## Validation Results\n\n`;
    content += `**Overall Status**: ${validation.isValid ? "✅ Valid" : "❌ Has Issues"}\n`;
    content += `**Score**: ${validation.overallScore}/100\n\n`;

    if (validation.issues && validation.issues.length > 0) {
      content += `**Issues** (${validation.issues.length}):\n`;
      validation.issues.forEach((issue) => (content += `• ${issue}\n`));
      content += "\n";
    }

    if (validation.warnings && validation.warnings.length > 0) {
      content += `**Warnings** (${validation.warnings.length}):\n`;
      validation.warnings.forEach((warning) => (content += `• ${warning}\n`));
      content += "\n";
    }

    if (validation.recommendations && validation.recommendations.length > 0) {
      content += `**Recommendations** (${validation.recommendations.length}):\n`;
      validation.recommendations.forEach((rec) => (content += `• ${rec}\n`));
    }

    addChatMessageWithTypewriter({
      type: "ai",
      content,
      metadata: {
        type: "validation_summary",
        snippet: true,
      },
    });
  }

  async function sendInstrumentSummary() {
    if (!analysis?.instrumentation) return;

    const instruments = analysis.instrumentation;
    let content = `## Instrumentation Summary\n\n`;
    content += `**Total Instruments**: ${instruments.total}\n\n`;

    const categories = [
      { key: "pressureInstruments", label: "Pressure" },
      { key: "temperatureInstruments", label: "Temperature" },
      { key: "flowInstruments", label: "Flow" },
      { key: "levelInstruments", label: "Level" },
      { key: "analyticalInstruments", label: "Analytical" },
    ];

    categories.forEach(({ key, label }) => {
      if (instruments[key] && instruments[key].length > 0) {
        content += `**${label}**: ${instruments[key].join(", ")}\n`;
      }
    });

    addChatMessageWithTypewriter({
      type: "ai",
      content,
      metadata: {
        type: "instrument_summary",
        snippet: true,
      },
    });
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleClearChat() {
    if (confirm("Are you sure you want to clear the chat history?")) {
      clearChat();
      addWelcomeMessage();
    }
  }

  function copyMessage(content) {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        showNotification("Message copied to clipboard", "success");
      })
      .catch((err) => {
        console.error("Failed to copy message:", err);
        showNotification("Failed to copy message", "error");
      });
  }

  function exportChat() {
    const chatData = $chatMessages.map((msg) => ({
      timestamp: msg.timestamp,
      type: msg.type,
      content: msg.content,
    }));

    const exportData = {
      timestamp: new Date().toISOString(),
      document: document?.name || "No document",
      messages: chatData,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pid-chat-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Quick action functions
  function askAboutEquipment() {
    chatInputValue.set("What equipment is shown in this drawing?");
    handleSendMessage();
  }

  function askAboutValidation() {
    chatInputValue.set("Please validate this P&ID and check for any issues.");
    handleSendMessage();
  }

  function askAboutInstruments() {
    chatInputValue.set(
      "What instrumentation can you identify in this drawing?",
    );
    handleSendMessage();
  }

  function askAboutPiping() {
    chatInputValue.set(
      "Analyze the piping layout and connections in this drawing.",
    );
    handleSendMessage();
  }
</script>

<div
  class="flex flex-col h-full bg-base-100 border-l border-base-content/10 overflow-hidden"
>
  <!-- Header with improved centering -->
  <div class="flex-shrink-0 border-b border-base-content/10 p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Properly centered AI icon -->
        <div
          class="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-lg"
        >
          <svg
            class="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            ></path>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-base-content">AI Assistant</h3>
          <p class="text-xs text-base-content/60">
            {document
              ? `Analyzing: ${document.name}`
              : "Ready to help with P&ID analysis"}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if !geminiValidatorService.isAvailable()}
          <button
            class="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
            data-tip="Configure Gemini AI"
            on:click={() => (showGeminiSettings = true)}
          >
            <Settings size={16} />
          </button>
        {/if}

        <button
          class="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
          data-tip="Export Chat"
          on:click={exportChat}
        >
          <Download size={16} />
        </button>

        <button
          class="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
          data-tip="Clear Chat"
          on:click={handleClearChat}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  </div>

  <!-- Gemini Settings Modal -->
  {#if showGeminiSettings}
    <div
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <div class="card bg-base-100 shadow-xl max-w-md w-full">
        <div class="card-body">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card-title">Configure Gemini AI</h3>
            <button
              class="btn btn-ghost btn-sm btn-circle"
              on:click={() => (showGeminiSettings = false)}
            >
              <X size={16} />
            </button>
          </div>

          <p class="text-sm text-base-content/70 mb-4">
            Enter your Google Gemini API key to enable advanced P&ID comparison
            and color markup detection.
          </p>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">AI Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. P&ID Expert"
              class="input input-bordered"
              bind:value={$aiModel}
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Comparison Sensitivity (Threshold)</span>
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value="30"
              class="range range-primary range-xs"
              on:change={(e) => {
                // Dispatch event or update store for sensitivity
                const val = parseInt(e.target.value);
                // We'll use a custom event or store if we had one, for now let's just log or store in localStorage
                localStorage.setItem("comparison_threshold", val);
                showNotification(`Sensitivity set to ${val}`, "info");
              }}
            />
            <div class="w-full flex justify-between text-xs px-2">
              <span>High</span>
              <span>Low</span>
            </div>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Gemini API Key</span>
            </label>
            <input
              type="password"
              placeholder="Enter your Gemini API key"
              class="input input-bordered"
              bind:value={geminiApiKey}
            />
          </div>

          <div class="card-actions justify-end mt-4">
            <button
              class="btn btn-ghost"
              on:click={() => (showGeminiSettings = false)}
            >
              Cancel
            </button>
            <button class="btn btn-primary" on:click={configureGeminiApi}>
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Quick actions -->
  {#if document && analysis}
    <div
      class="p-3 bg-base-200/50 border-b border-base-content/10 flex-shrink-0"
    >
      <div class="text-xs font-medium text-base-content/70 mb-2">
        Quick Actions:
      </div>
      <div class="flex flex-wrap gap-1">
        <button class="btn btn-outline btn-xs" on:click={askAboutEquipment}>
          Equipment
        </button>
        <button class="btn btn-outline btn-xs" on:click={askAboutValidation}>
          Validation
        </button>
        <button class="btn btn-outline btn-xs" on:click={askAboutInstruments}>
          Instruments
        </button>
        <button class="btn btn-outline btn-xs" on:click={askAboutPiping}>
          Piping
        </button>
      </div>
    </div>
  {/if}

  <!-- Messages container -->
  <div
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
    style="max-height: calc(100vh - 300px); overflow-x: hidden;"
    on:scroll={() => {
      autoScroll =
        chatContainer.scrollTop >=
        chatContainer.scrollHeight - chatContainer.clientHeight - 50;
    }}
  >
    <!-- Debug info and empty state -->
    {#if $chatMessages.length === 0}
      <div class="text-center text-base-content/40 text-sm p-8">
        <div class="flex flex-col items-center gap-2">
          <div
            class="w-12 h-12 bg-base-200 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.456L3 21l2.456-5.094A7.963 7.963 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
              ></path>
            </svg>
          </div>
          <div>No messages yet...</div>
          <div class="text-xs opacity-60">
            Start a conversation by typing a message!
          </div>
        </div>
      </div>
    {/if}

    {#each $chatMessages as message (message.id)}
      <div class="chat {message.type === 'user' ? 'chat-end' : 'chat-start'}">
        <!-- Properly centered chat avatar -->
        <div class="chat-image avatar">
          <div
            class="w-8 h-8 rounded-full {message.type === 'user'
              ? 'bg-primary'
              : 'bg-secondary'} flex items-center justify-center"
          >
            {#if message.type === "user"}
              <svg
                class="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clip-rule="evenodd"
                ></path>
              </svg>
            {:else}
              <svg
                class="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                ></path>
              </svg>
            {/if}
          </div>
        </div>

        <div class="chat-header">
          {message.type === "user" ? "You" : "AI Assistant"}
          <time class="text-xs opacity-50 ml-2">
            {formatDistanceToNow(message.timestamp)} ago
          </time>
        </div>

        <div
          class="chat-bubble {message.type === 'user'
            ? 'chat-bubble-primary'
            : 'chat-bubble-secondary'} max-w-none"
        >
          <!-- Message content with better error handling -->
          <div
            class="prose prose-sm max-w-none {message.type === 'user'
              ? 'prose-invert'
              : ''}"
          >
            {#if message.content && typeof message.content === "string" && message.content.trim().length > 0}
              {#if message.content.includes("\n") || message.content.includes("**")}
                <!-- Render formatted content -->
                {@html message.content
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\n/g, "<br>")
                  .replace(/^## (.*?)$/gm, "<h3>$1</h3>")
                  .replace(/^### (.*?)$/gm, "<h4>$1</h4>")
                  .replace(/^• (.*?)$/gm, "<li>$1</li>")
                  .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")}
              {:else}
                {message.content}
              {/if}
            {:else if typewriterMessages.has(message.id)}
              <!-- Show typing indicator for messages being typed -->
              <span class="text-base-content/60">Typing...</span>
            {:else if message.originalContent}
              <!-- Fallback to original content if main content is empty -->
              {message.originalContent}
            {:else}
              <!-- Only show this for truly empty messages -->
              <span class="text-base-content/40 italic">Loading message...</span
              >
            {/if}

            <!-- Typewriter cursor for AI messages that are currently typing -->
            {#if message.type === "ai" && typewriterMessages.has(message.id)}
              <span class="typewriter-cursor">|</span>
            {/if}
          </div>

          <!-- Message metadata -->
          {#if message.metadata?.snippet}
            <div class="mt-2 pt-2 border-t border-base-content/20">
              <div class="flex items-center gap-2 text-xs text-base-content/60">
                <Info size={12} />
                <span>Analysis Summary</span>
              </div>
            </div>
          {/if}
        </div>

        <div class="chat-footer">
          <div class="flex gap-1 mt-1">
            <button
              class="btn btn-ghost btn-xs"
              on:click={() => copyMessage(message.content)}
              title="Copy message"
            >
              <Copy size={10} />
            </button>
          </div>
        </div>
      </div>
    {/each}

    <!-- Typing indicator -->
    {#if isTyping || $aiProcessing}
      <div class="chat chat-start">
        <div class="chat-image avatar">
          <div
            class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
          >
            <svg
              class="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              ></path>
            </svg>
          </div>
        </div>

        <div class="chat-bubble chat-bubble-secondary">
          <div class="loading-dots">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Input area -->
  <div class="border-t border-base-content/10 p-4 flex-shrink-0">
    <div class="flex gap-3">
      <textarea
        bind:this={messageInput}
        bind:value={$chatInputValue}
        on:keypress={handleKeyPress}
        placeholder={document
          ? "Ask about this P&ID drawing..."
          : "Upload a document to start chatting..."}
        disabled={$aiProcessing || currentlyTyping}
        class="textarea textarea-bordered textarea-sm flex-1 resize-none min-h-[2.5rem] max-h-32"
        rows="1"
      ></textarea>

      <button
        class="btn btn-primary btn-sm"
        disabled={!$chatInputValue.trim() || $aiProcessing || currentlyTyping}
        on:click={handleSendMessage}
      >
        {#if $aiProcessing || currentlyTyping}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Send size={16} />
        {/if}
      </button>
    </div>

    <!-- Status indicators -->
    <div
      class="flex items-center justify-between mt-2 text-xs text-base-content/60"
    >
      <div class="flex items-center gap-4">
        {#if geminiValidatorService.isAvailable()}
          <span class="flex items-center gap-1 text-success">
            <CheckCircle size={10} />
            Gemini AI Ready
          </span>
        {/if}

        {#if document}
          <span class="flex items-center gap-1">
            <FileText size={10} />
            Document: {document.name.substring(0, 20)}{document.name.length > 20
              ? "..."
              : ""}
          </span>
        {/if}

        {#if analysis}
          <span class="flex items-center gap-1 text-success">
            <CheckCircle size={10} />
            Analyzed
          </span>
        {/if}

        {#if validation && !validation.isValid}
          <span class="flex items-center gap-1 text-warning">
            <AlertTriangle size={10} />
            Has Issues
          </span>
        {/if}
      </div>

      <div>Press Enter to send • Shift+Enter for new line</div>
    </div>
  </div>
</div>

<style>
  .prose h3 {
    @apply text-base font-semibold mb-2 mt-3;
  }

  .prose h4 {
    @apply text-sm font-medium mb-1 mt-2;
  }

  .prose ul {
    @apply list-none pl-0 space-y-1;
  }

  .prose li {
    @apply text-sm;
  }

  .chat-bubble {
    max-width: 85%;
  }

  .loading-dots {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .loading-dots div {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    animation: loading-pulse 1.4s ease-in-out infinite both;
  }

  .loading-dots div:nth-child(1) {
    animation-delay: -0.32s;
  }
  .loading-dots div:nth-child(2) {
    animation-delay: -0.16s;
  }
  .loading-dots div:nth-child(3) {
    animation-delay: 0s;
  }

  @keyframes loading-pulse {
    0%,
    80%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    40% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  /* Typewriter cursor animation */
  .typewriter-cursor {
    animation: blink 1s infinite;
    font-weight: bold;
    color: currentColor;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }

  /* Improved avatar centering */
  .chat-image {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    align-self: center;
  }

  .chat-image .avatar {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .chat-image .avatar div {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
</style>
