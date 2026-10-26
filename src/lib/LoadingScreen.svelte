<script>
  import { onMount } from 'svelte';
  import { Brain, Download, Zap, CheckCircle, Sparkles, Activity, Upload, Archive } from 'lucide-svelte';
  import { addActivityLog } from './stores.js';

  let loadingSteps = [
    { id: 'ai', label: 'Initializing AI Engine', status: 'loading', icon: Brain, detail: 'Loading neural networks for P&ID analysis...' },
    { id: 'services', label: 'Starting Document Services', status: 'pending', icon: Zap, detail: 'Configuring PDF processing and image analysis...' },
    { id: 'features', label: 'Enabling Advanced Features', status: 'pending', icon: Sparkles, detail: 'Activating color detection and batch processing...' },
    { id: 'ready', label: 'System Ready', status: 'pending', icon: CheckCircle, detail: 'Ready to analyze your P&ID drawings!' }
  ];

  let currentStep = 0;
  let progress = 0;
  let detailedProgress = '';
  let animationPhase = 'initializing'; // initializing, processing, finalizing
  let showFeatures = false;

  // Enhanced features to showcase
  const features = [
    { icon: Upload, text: 'Multi-file & ZIP upload support', delay: 0 },
    { icon: Brain, text: 'Advanced AI symbol recognition', delay: 200 },
    { icon: Activity, text: 'Real-time activity monitoring', delay: 400 },
    { icon: Sparkles, text: 'Color markup detection', delay: 600 },
    { icon: Archive, text: 'Batch processing capabilities', delay: 800 },
    { icon: Zap, text: 'Optimized performance engine', delay: 1000 }
  ];

  onMount(() => {
    // Log the initialization start
    addActivityLog('Application initialization started', 'info');
    
    // Extended loading simulation with more realistic timing
    const timer = setInterval(() => {
      progress += Math.random() * 8 + 2; // Slower, more realistic progress
      
      // Update detailed progress messages
      if (progress < 20) {
        detailedProgress = 'Loading AI model weights...';
        animationPhase = 'initializing';
      } else if (progress < 35 && currentStep === 0) {
        detailedProgress = 'Neural networks loaded successfully';
        loadingSteps[0].status = 'completed';
        loadingSteps[1].status = 'loading';
        currentStep = 1;
        animationPhase = 'processing';
        addActivityLog('AI Engine initialized', 'success');
      } else if (progress < 50) {
        detailedProgress = 'Configuring document processing pipeline...';
      } else if (progress < 65 && currentStep === 1) {
        detailedProgress = 'Document services activated';
        loadingSteps[1].status = 'completed';
        loadingSteps[2].status = 'loading';
        currentStep = 2;
        showFeatures = true;
        addActivityLog('Document services started', 'success');
      } else if (progress < 80) {
        detailedProgress = 'Enabling advanced processing features...';
      } else if (progress < 90 && currentStep === 2) {
        detailedProgress = 'All features enabled';
        loadingSteps[2].status = 'completed';
        loadingSteps[3].status = 'loading';
        currentStep = 3;
        animationPhase = 'finalizing';
        addActivityLog('Advanced features enabled', 'success');
      } else if (progress >= 100) {
        detailedProgress = 'Welcome to P&ID Blueprint Analyzer!';
        loadingSteps[3].status = 'completed';
        animationPhase = 'ready';
        addActivityLog('Application ready', 'success');
        
        // Keep the loading screen visible a bit longer for appreciation
        setTimeout(() => {
          clearInterval(timer);
        }, 2000); // Additional 2 seconds to appreciate the loading
      }
      
      progress = Math.min(progress, 100);
    }, 150); // Slower interval for smoother experience

    return () => clearInterval(timer);
  });

  function getStepIcon(step) {
    switch (step.status) {
      case 'completed':
        return CheckCircle;
      case 'loading':
        return step.icon;
      default:
        return step.icon;
    }
  }

  function getStepClass(step) {
    switch (step.status) {
      case 'completed':
        return 'text-success';
      case 'loading':
        return 'text-primary animate-pulse';
      default:
        return 'text-base-content/50';
    }
  }

  function getAnimationClass() {
    switch (animationPhase) {
      case 'initializing':
        return 'animate-pulse';
      case 'processing':
        return 'animate-bounce';
      case 'finalizing':
        return 'animate-spin';
      case 'ready':
        return 'animate-none scale-110';
      default:
        return '';
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-base-300 via-base-200 to-base-300 flex items-center justify-center p-4 overflow-hidden relative">
  <!-- Animated background elements -->
  <div class="absolute inset-0 overflow-hidden">
    <div class="absolute top-10 left-10 w-20 h-20 bg-primary/10 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
    <div class="absolute top-32 right-20 w-16 h-16 bg-secondary/10 rounded-full animate-bounce" style="animation-delay: 0.5s;"></div>
    <div class="absolute bottom-20 left-1/4 w-12 h-12 bg-accent/10 rounded-full animate-bounce" style="animation-delay: 1s;"></div>
    <div class="absolute bottom-32 right-1/3 w-24 h-24 bg-primary/5 rounded-full animate-bounce" style="animation-delay: 1.5s;"></div>
    
    <!-- Floating particles -->
    {#each Array(8) as _, i}
      <div 
        class="absolute w-2 h-2 bg-primary/20 rounded-full animate-float"
        style="left: {Math.random() * 100}%; top: {Math.random() * 100}%; animation-delay: {i * 0.5}s;"
      ></div>
    {/each}
  </div>

  <div class="max-w-lg w-full relative z-10">
    <!-- Enhanced Logo Section -->
    <div class="text-center mb-8">
      <div class="relative mx-auto mb-6">
        <div class="w-24 h-24 bg-gradient-to-br from-primary via-secondary to-accent rounded-3xl mx-auto flex items-center justify-center shadow-2xl {getAnimationClass()}">
          <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        
        <!-- Animated rings around logo -->
        <div class="absolute inset-0 w-24 h-24 mx-auto rounded-full border-2 border-primary/30 animate-ping"></div>
        <div class="absolute inset-0 w-24 h-24 mx-auto rounded-full border-2 border-secondary/20 animate-ping" style="animation-delay: 0.5s;"></div>
      </div>
      
      <h1 class="text-4xl font-bold gradient-text mb-3 animate-fade-in">P&ID Analyzer</h1>
      <p class="text-xl text-base-content/70 animate-fade-in" style="animation-delay: 0.2s;">AI-Powered Blueprint Analysis Platform</p>
      <p class="text-sm text-base-content/50 mt-2 animate-fade-in" style="animation-delay: 0.4s;">Version 2.0 • Enhanced Edition</p>
    </div>

    <!-- Enhanced Loading Card -->
    <div class="card bg-base-100/90 backdrop-blur-lg shadow-2xl border border-base-content/10 animate-slide-up">
      <div class="card-body p-6">
        <!-- Enhanced Progress Section -->
        <div class="mb-6">
          <div class="flex justify-between text-sm font-medium mb-3">
            <span class="flex items-center gap-2">
              <Sparkles size={16} class="text-primary animate-spin" />
              Initializing Advanced Features
            </span>
            <span class="font-mono">{Math.round(progress)}%</span>
          </div>
          
          <!-- Multi-layered progress bar -->
          <div class="relative w-full bg-base-300 rounded-full h-3 overflow-hidden">
            <div 
              class="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent h-3 rounded-full transition-all duration-700 ease-out"
              style="width: {progress}%"
            ></div>
            <div 
              class="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent h-3 rounded-full animate-shimmer"
              style="width: {progress}%"
            ></div>
          </div>
          
          <!-- Detailed progress text -->
          <div class="text-xs text-base-content/60 mt-2 h-4 transition-all duration-300">
            {detailedProgress}
          </div>
        </div>

        <!-- Enhanced Loading Steps -->
        <div class="space-y-4 mb-6">
          {#each loadingSteps as step, index}
            <div class="flex items-center gap-4 {getStepClass(step)} transition-all duration-500"
                 style="animation-delay: {index * 0.1}s;">
              <!-- Enhanced Step Icon -->
              <div class="relative">
                <div class="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center flex-shrink-0 transition-all duration-300">
                  {#if step.status === 'loading'}
                    <div class="loading loading-spinner loading-sm"></div>
                  {:else}
                    <svelte:component this={getStepIcon(step)} size={18} />
                  {/if}
                </div>
                
                {#if step.status === 'completed'}
                  <div class="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                    <CheckCircle size={10} class="text-white" />
                  </div>
                {/if}
              </div>
              
              <!-- Enhanced Step Content -->
              <div class="flex-1">
                <div class="font-semibold text-sm">{step.label}</div>
                <div class="text-xs opacity-70 mt-1 transition-all duration-300">
                  {#if step.status === 'completed'}
                    ✅ Complete - {step.detail}
                  {:else if step.status === 'loading'}
                    ⚡ {step.detail}
                  {:else}
                    ⏳ Waiting - {step.detail}
                  {/if}
                </div>
              </div>
              
              <!-- Enhanced Step Indicator -->
              <div class="flex items-center gap-2">
                {#if step.status === 'loading'}
                  <div class="w-3 h-3 rounded-full bg-current animate-pulse"></div>
                {:else if step.status === 'completed'}
                  <div class="w-3 h-3 rounded-full bg-success animate-ping"></div>
                {:else}
                  <div class="w-3 h-3 rounded-full bg-current/20"></div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Enhanced Features Showcase -->
        {#if showFeatures}
          <div class="border-t border-base-content/10 pt-6 animate-fade-in">
            <div class="text-sm font-medium text-base-content/70 mb-4 flex items-center gap-2">
              <Sparkles size={14} />
              Enhanced Capabilities
            </div>
            <div class="grid grid-cols-1 gap-3">
              {#each features as feature, index}
                <div 
                  class="flex items-center gap-3 p-2 rounded-lg bg-base-200/30 hover:bg-base-200/50 transition-all duration-300 animate-slide-in-right"
                  style="animation-delay: {feature.delay}ms;"
                >
                  <svelte:component this={feature.icon} size={14} class="text-primary flex-shrink-0" />
                  <span class="text-xs font-medium">{feature.text}</span>
                  <div class="ml-auto w-2 h-2 bg-success rounded-full animate-ping"></div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Enhanced Tips Section -->
        <div class="mt-6 p-4 bg-gradient-to-r from-info/10 via-primary/10 to-secondary/10 rounded-xl border border-info/20">
          <div class="text-xs text-info font-semibold mb-2 flex items-center gap-2">
            <Activity size={12} />
            <span>System Information</span>
          </div>
          <div class="text-xs text-base-content/70 space-y-1">
            <div>🔒 All processing happens locally in your browser</div>
            <div>🚀 Enhanced with advanced AI capabilities</div>
            <div>📁 Support for ZIP archives and batch processing</div>
            <div>🎨 Real-time activity monitoring and color detection</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Enhanced Version Info -->
    <div class="text-center mt-6 space-y-2 animate-fade-in" style="animation-delay: 1s;">
      <div class="text-xs text-base-content/50">
        P&ID Blueprint Analyzer v2.0 • Enhanced Edition
      </div>
      <div class="text-xs text-base-content/40">
        Built with ❤️ using Svelte, AI & Advanced Analytics
      </div>
    </div>
  </div>
</div>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #06B6D4 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient-shift 3s ease-in-out infinite;
  }

  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .animate-slide-up {
    animation: slideUp 0.8s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(40px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.8s ease-out both;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-in-right {
    animation: slideInRight 0.6s ease-out both;
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33% { transform: translateY(-10px) rotate(120deg); }
    66% { transform: translateY(5px) rotate(240deg); }
  }

  .animate-shimmer {
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .animate-bounce {
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: translateY(-15px);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
  }

  /* Card hover effects */
  .card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  }

  /* Enhanced progress bar styling (fallback gradient so build tools won't error) */
  .w-full.bg-base-300 {
    background: linear-gradient(90deg,
      rgba(0,0,0,0.04) 0%,
      rgba(255,255,255,0.03) 50%,
      rgba(0,0,0,0.04) 100%);
  }
</style>

