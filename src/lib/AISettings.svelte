<script>
  import { aiConfig, updateAIName, updateAIConfig, showActivityLog, addActivityLog } from './stores.js';
  import { Settings, Bot, Brain, Sparkles, Save, RotateCcw, Activity } from 'lucide-svelte';
  
  export let showSettings = false;
  
  let localAiName = $aiConfig.name;
  let localTemperature = $aiConfig.temperature;
  let localMaxTokens = $aiConfig.maxTokens;
  let localSystemPrompt = $aiConfig.systemPrompt;
  
  // Predefined AI names for quick selection
  const presetNames = [
    'Blueprint Assistant',
    'P&ID Analyzer',
    'Engineering Buddy',
    'Technical Guru',
    'Drawing Expert',
    'CAD Companion',
    'Blueprint Wizard',
    'Engineering AI',
    'Document Detective'
  ];

  function saveSettings() {
    // Update AI configuration
    updateAIConfig({
      name: localAiName,
      temperature: localTemperature,
      maxTokens: localMaxTokens,
      systemPrompt: localSystemPrompt
    });
    
    addActivityLog(`Settings updated: AI name set to "${localAiName}"`, 'success');
    showSettings = false;
  }

  function resetSettings() {
    localAiName = 'Blueprint Assistant';
    localTemperature = 0.7;
    localMaxTokens = 1000;
    localSystemPrompt = 'You are a helpful P&ID analysis assistant specialized in blueprint analysis and engineering drawings.';
    
    addActivityLog('Settings reset to defaults', 'info');
  }

  function selectPresetName(name) {
    localAiName = name;
    addActivityLog(`AI name preset selected: "${name}"`, 'info');
  }

  function toggleActivityLog() {
    showActivityLog.update(show => !show);
  }

  // Sync with global config when it changes
  $: {
    localAiName = $aiConfig.name;
    localTemperature = $aiConfig.temperature;
    localMaxTokens = $aiConfig.maxTokens;
    localSystemPrompt = $aiConfig.systemPrompt;
  }
</script>

{#if showSettings}
  <!-- Settings Modal -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="card bg-base-100 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
      <div class="card-body p-0">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-base-content/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <Settings size={20} class="text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold">AI Settings</h3>
              <p class="text-sm text-base-content/70">Customize your AI assistant</p>
            </div>
          </div>
          
          <button 
            class="btn btn-sm btn-ghost btn-circle" 
            on:click={() => showSettings = false}
          >
            ✕
          </button>
        </div>

        <!-- Settings Content -->
        <div class="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <!-- AI Name Section -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <Bot size={20} class="text-primary" />
              <h4 class="text-lg font-semibold">AI Assistant Name</h4>
            </div>
            
            <!-- Current AI Name -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Assistant Name</span>
                <span class="label-text-alt text-base-content/60">What should I call your AI?</span>
              </label>
              <input 
                type="text" 
                bind:value={localAiName}
                placeholder="Enter AI name..."
                class="input input-bordered w-full focus:input-primary"
                maxlength="30"
              />
            </div>

            <!-- Preset Names -->
            <div>
              <label class="label">
                <span class="label-text">Quick Presets</span>
              </label>
              <div class="flex flex-wrap gap-2">
                {#each presetNames as preset}
                  <button 
                    class="btn btn-sm btn-outline hover:btn-primary transition-all duration-200"
                    class:btn-primary={localAiName === preset}
                    on:click={() => selectPresetName(preset)}
                  >
                    {preset}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Advanced AI Configuration -->
          <div class="divider">
            <div class="flex items-center gap-2 text-base-content/70">
              <Brain size={16} />
              <span>Advanced Configuration</span>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Temperature Setting -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Creativity Level (Temperature)</span>
                <span class="label-text-alt">{localTemperature}</span>
              </label>
              <input 
                type="range" 
                bind:value={localTemperature}
                min="0" 
                max="1" 
                step="0.1" 
                class="range range-primary" 
              />
              <div class="w-full flex justify-between text-xs text-base-content/60 mt-1">
                <span>Conservative</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            <!-- Max Tokens -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Response Length (Max Tokens)</span>
                <span class="label-text-alt">{localMaxTokens} tokens</span>
              </label>
              <input 
                type="range" 
                bind:value={localMaxTokens}
                min="100" 
                max="2000" 
                step="100" 
                class="range range-secondary" 
              />
              <div class="w-full flex justify-between text-xs text-base-content/60 mt-1">
                <span>Short</span>
                <span>Medium</span>
                <span>Detailed</span>
              </div>
            </div>

            <!-- System Prompt -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">AI Personality (System Prompt)</span>
                <span class="label-text-alt">How should the AI behave?</span>
              </label>
              <textarea 
                bind:value={localSystemPrompt}
                placeholder="Describe how the AI should behave..."
                class="textarea textarea-bordered h-24 resize-none focus:textarea-primary"
                maxlength="500"
              ></textarea>
              <div class="label">
                <span class="label-text-alt text-base-content/60">
                  {localSystemPrompt.length}/500 characters
                </span>
              </div>
            </div>
          </div>

          <!-- Activity Log Settings -->
          <div class="divider">
            <div class="flex items-center gap-2 text-base-content/70">
              <Activity size={16} />
              <span>Activity & Monitoring</span>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-lg">
              <div class="flex items-center gap-3">
                <Activity size={20} class="text-primary" />
                <div>
                  <div class="font-medium">Activity Log</div>
                  <div class="text-sm text-base-content/70">Track AI processes in real-time</div>
                </div>
              </div>
              <button 
                class="btn btn-sm btn-primary gap-2" 
                on:click={toggleActivityLog}
              >
                <Activity size={14} />
                {$showActivityLog ? 'Hide' : 'Show'} Log
              </button>
            </div>
          </div>

          <!-- Preview Section -->
          <div class="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-3">
              <Sparkles size={16} class="text-primary" />
              <span class="font-medium">Preview</span>
            </div>
            <div class="text-sm">
              <div class="font-medium">Assistant: {localAiName}</div>
              <div class="text-base-content/70 mt-1">
                {localSystemPrompt.length > 100 ? localSystemPrompt.substring(0, 100) + '...' : localSystemPrompt}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between p-6 border-t border-base-content/20 bg-base-200/30">
          <button 
            class="btn btn-outline gap-2" 
            on:click={resetSettings}
          >
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          
          <div class="flex gap-3">
            <button 
              class="btn btn-ghost" 
              on:click={() => showSettings = false}
            >
              Cancel
            </button>
            <button 
              class="btn btn-primary gap-2" 
              on:click={saveSettings}
            >
              <Save size={16} />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .card {
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Enhanced range styling */
  .range::-webkit-slider-thumb {
    transition: all 0.2s ease;
  }

  .range::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  /* Enhanced button hover effects */
  .btn {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  /* Enhanced textarea styling */
  .textarea:focus {
    box-shadow: 0 0 0 2px rgba(96,165,250,0.2); /* fallback using blue-400 at 20% opacity */
    outline: none;
  }
</style>
