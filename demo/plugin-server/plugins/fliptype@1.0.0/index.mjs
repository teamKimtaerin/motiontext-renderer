/**
 * 3D Flip Card + Typing Effect Plugin
 * Hybrid plugin combining DOM manipulation (typing) with channel-based 3D rotation
 */

const PLUGIN_NAME = 'fliptype@1.0.0';

// Channel-based implementation (3D flip effect)
export function evalChannels(plugin, progress, context) {
  const { flipAngle = 180, flipDirection = 'horizontal', flipDuration = 0.6 } = plugin.params || {};
  
  console.log(`[${PLUGIN_NAME}] 📊 evalChannels called:`, {
    progress,
    flipAngle,
    flipDirection,
    flipDuration
  });
  
  // Calculate flip progress (only during flipDuration portion)
  const flipProgress = Math.min(progress / flipDuration, 1.0);
  
  // Smooth easing for flip (ease-in-out)
  const easedProgress = flipProgress < 0.5 
    ? 2 * flipProgress * flipProgress 
    : 1 - Math.pow(-2 * flipProgress + 2, 3) / 2;
  
  // Calculate rotation angle
  const currentAngle = easedProgress * flipAngle;
  
  console.log(`[${PLUGIN_NAME}] 🔄 Flip calculation:`, {
    flipProgress,
    easedProgress,
    currentAngle
  });
  
  // Return appropriate rotation channel
  const channels = {};
  if (flipDirection === 'vertical') {
    channels.rotateX = currentAngle;
  } else {
    channels.rotateY = currentAngle;
  }
  
  console.log(`[${PLUGIN_NAME}] ✨ Returning channels:`, channels);
  
  return channels;
}

// DOM-based implementation (typing effect)
let typingStates = new Map();

export function init(element, params, context) {
  console.log(`[${PLUGIN_NAME}] ✅ INIT CALLED`, { 
    element, 
    params, 
    context,
    hasGsap: !!context?.gsap,
    gsapTimeline: typeof context?.gsap?.timeline
  });
  
  if (!context?.gsap) {
    console.error(`[${PLUGIN_NAME}] ❌ GSAP is required for fliptype effect`);
    return;
  }
  
  const nodeId = element.dataset?.nodeId || Math.random().toString(36);
  
  // Initialize typing state
  if (!typingStates.has(nodeId)) {
    typingStates.set(nodeId, {
      initialized: false,
      timeline: null,
      originalText: '',
      characters: []
    });
  }
  
  console.log(`[${PLUGIN_NAME}] Setting up typing structure...`);
  setupTypingDOM(element, typingStates.get(nodeId));
  console.log(`[${PLUGIN_NAME}] Structure setup complete`);
}

export function animate(element, params, context, duration) {
  console.log(`[${PLUGIN_NAME}] 🎬 ANIMATE CALLED`, { 
    element, 
    params, 
    context, 
    duration,
    hasGsap: !!context?.gsap,
    hasElement: !!element
  });
  
  const { 
    typingSpeed = 15, 
    typingDelay = 0.3, 
    flipDuration = 0.6 
  } = params || {};
  
  const nodeId = element.dataset?.nodeId || Math.random().toString(36);
  const gsap = context?.gsap;
  
  if (!gsap) {
    console.error(`[${PLUGIN_NAME}] ❌ GSAP is required for fliptype effect`);
    return (progress) => {};
  }
  
  let state = typingStates.get(nodeId);
  if (!state) {
    state = {
      initialized: false,
      timeline: null,
      originalText: '',
      characters: []
    };
    typingStates.set(nodeId, state);
  }
  
  // Initialize DOM structure for typing effect
  if (!state.initialized) {
    setupTypingDOM(element, state);
    state.initialized = true;
  }
  
  // Create GSAP timeline for typing animation
  if (!state.timeline) {
    state.timeline = createTypingTimeline(state, gsap, {
      typingSpeed,
      typingDelay,
      flipDuration,
      duration
    });
  }
  
  // Return seek function
  return (progress) => {
    if (state.timeline) {
      // Convert progress to timeline position
      const timelineProgress = Math.max(0, Math.min(1, progress));
      state.timeline.progress(timelineProgress);
    }
  };
}

export function cleanup(element) {
  if (element && window.gsap) {
    window.gsap.killTweensOf(element.querySelectorAll('*'));
    
    const nodeId = element.dataset?.nodeId || '';
    const state = typingStates.get(nodeId);
    
    if (state) {
      // Kill GSAP timeline
      if (state.timeline) {
        state.timeline.kill();
      }
      
      // Restore original text
      if (state.originalText) {
        element.textContent = state.originalText;
      }
      
      // Remove state
      typingStates.delete(nodeId);
    }
    
    console.log(`[${PLUGIN_NAME}] cleanup completed for node: ${nodeId}`);
  }
}

// Helper function to setup DOM structure for typing
function setupTypingDOM(element, state) {
  if (!element) return;

  // Prefer existing text inside effects root; if empty, fallback to host text
  let text = element.textContent || '';
  const host = element.parentElement;
  if ((!text || !text.trim()) && host) {
    // Gather only text nodes from host, but preserve existing element children (like effectsRoot)
    let collected = '';
    const toRemove = [];
    for (const node of Array.from(host.childNodes)) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        collected += node.textContent || '';
        toRemove.push(node);
      }
    }
    toRemove.forEach((n) => host.removeChild(n));
    text = collected;
  }
  
  state.originalText = text || 'Flip Type Effect';
  
  // Clear element and setup container
  element.innerHTML = '';
  element.className = 'fliptype-effect';
  
  const container = document.createElement('span');
  container.className = 'fliptype-container';
  container.style.display = 'inline-block';
  
  // Split text into characters
  const characters = state.originalText.split('');
  state.characters = [];
  
  // Create span for each character
  characters.forEach((char, index) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char; // Use non-breaking space
    span.style.opacity = '0';
    span.style.display = 'inline-block';
    span.style.transform = 'scale(0.8)';
    span.dataset.charIndex = index.toString();
    
    container.appendChild(span);
    state.characters.push(span);
  });
  
  element.appendChild(container);
  
  console.log(`[${PLUGIN_NAME}] DOM setup completed, ${characters.length} characters`);
}

// Helper function to create typing timeline
function createTypingTimeline(state, gsap, options) {
  const { typingSpeed, typingDelay, flipDuration, duration } = options;
  
  const timeline = gsap.timeline({ paused: true });
  
  if (state.characters.length === 0) {
    return timeline;
  }
  
  // Calculate timing
  const typingDuration = state.characters.length / typingSpeed;
  const typingStart = typingDelay; // Start typing at this progress point
  const typingEnd = Math.min(1.0, typingStart + (typingDuration / duration));
  
  // Add typing animation to timeline
  const staggerDelay = (typingEnd - typingStart) / state.characters.length;
  
  // Set timeline to start at typing delay
  timeline.set({}, {}, typingStart);
  
  // Animate each character with stagger
  state.characters.forEach((char, index) => {
    const startTime = typingStart + (index * staggerDelay);
    const endTime = Math.min(1.0, startTime + 0.1); // Quick fade in
    
    timeline.fromTo(char, 
      { opacity: 0, scale: 0.8 },
      { 
        opacity: 1, 
        scale: 1,
        duration: endTime - startTime,
        ease: "back.out(1.7)"
      },
      startTime
    );
  });
  
  console.log(`[${PLUGIN_NAME}] Timeline created:`, {
    charactersCount: state.characters.length,
    typingStart,
    typingEnd,
    typingDuration,
    staggerDelay
  });
  
  return timeline;
}

// Plugin metadata
export const metadata = {
  name: PLUGIN_NAME,
  version: '1.0.0',
  type: 'hybrid',
  description: '3D flip card effect combined with typing animation'
};