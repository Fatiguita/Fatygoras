const STORAGE_KEY_BROWSER_OVERRIDE = 'fatygoras_audio_tier_override';

// --- Global variables for robust audio control ---
let currentFallbackAudio: HTMLAudioElement | null = null; // Tracks active HTMLAudioElement for Google TTS fallback
let playbackSessionId = 0; // Incremented on cancel, used to invalidate pending async playbacks

// Helper to map strict ISO codes (ja-JP) to Google Translate friendly codes (ja)
const sanitizeLangForGoogle = (isoLang: string): string => {
    // Special cases where Google uses full code (e.g., Chinese, Brazilian Portuguese)
    if (['zh-CN', 'zh-TW', 'pt-BR', 'en-GB', 'en-US'].includes(isoLang)) {
        return isoLang;
    }
    // For most others (es-ES, ja-JP, fr-FR), Google prefers the 2-letter prefix
    return isoLang.split('-')[0];
};

export const getDetectedBrowserName = (): string => {
   if (typeof navigator === 'undefined') return "Unknown";
   const ua = navigator.userAgent;

   // ORDER MATTERS: Chromium browsers (Opera, Edge) include "Chrome" in their string.
   // We must check for the specific ones FIRST.

   // Opera / Opera GX
   if (/OPR\//.test(ua)) return "Opera / Opera GX";
   
   // Microsoft Edge
   if (/Edg\//.test(ua)) return "Microsoft Edge";
   
   // Brave (Hard to detect reliably as it intentionally mimics Chrome)
   if ((navigator as any).brave && (navigator as any).brave.isBrave) {
       return "Brave Browser";
   }

   // Standard Chrome (or Brave masquerading perfectly)
   if (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor)) return "Google Chrome";
   
   // Others
   if (/Firefox/.test(ua)) return "Firefox";
   if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
   if (/Trident/.test(ua)) return "Internet Explorer";
   
   return "Unknown Browser";
};

export const getBrowserTierOverride = () => localStorage.getItem(STORAGE_KEY_BROWSER_OVERRIDE) || 'auto';

export const setBrowserTierOverride = (tier: 'auto' | 'high' | 'low') => {
    localStorage.setItem(STORAGE_KEY_BROWSER_OVERRIDE, tier);
};

export const isHighTierBrowser = (): boolean => {
  const override = getBrowserTierOverride();
  if (override === 'high') return true; 
  if (override === 'low') return false; 

  const ua = navigator.userAgent;
  
  // TIER DEFINITION:
  // High Tier = Browsers with reliable, built-in, multi-lingual Neural TTS.
  // Generally: Official Google Chrome and Microsoft Edge.
  // 
  // Low Tier (Fallback to API) = Browsers relying on bare OS voices (which might lack specific languages).
  // Includes: Firefox, Safari, Opera, and BRAVE (Brave strips Google services).

  const isEdge = /Edg\//.test(ua);
  // Chrome Check: Must have Chrome in UA, Google Vendor, and NOT be Opera
  const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor) && !/OPR\//.test(ua);
  
  // Brave detection (Brave often mimics Chrome exactly, so we might miss it without the property check)
  const isBrave = (navigator as any).brave && (navigator as any).brave.isBrave;

  // Only Edge and pure Chrome are trusted for High Quality Native TTS by default
  return !!(isEdge || (isChrome && !isBrave));
};

// --- Centralized audio cancellation function ---
/**
 * Stops all currently playing audio, both native SpeechSynthesis and any active
 * HTMLAudioElement used for Google Translate fallback.
 */
export const cancelAudio = () => {
    // Increment sessionId to invalidate all pending async playback requests
    playbackSessionId++; 
    
    // Stop Native TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // Stop Google Fallback Audio if playing
    if (currentFallbackAudio) {
        currentFallbackAudio.pause();
        currentFallbackAudio.src = ""; // Detach source to stop downloading/buffering
        currentFallbackAudio = null;
    }
    console.log(`[Audio] All active audio cancelled. New Playback Session ID: ${playbackSessionId}`);
};


// --- CORE PLAYBACK LOGIC (Promise-based for sequential playback) ---

/**
 * Helper function to play an audio URL and return a Promise that resolves when the audio finishes.
 * Handles potential autoplay blocks.
 */
const tryPlayUrl = (url: string, sessionId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        // 1. Immediate Session Check: If session changed while we were waiting to run, abort.
        if (sessionId !== playbackSessionId) {
            console.warn(`[Audio] Google Fallback (tryPlayUrl) aborted due to session change. Expected: ${sessionId}, Current: ${playbackSessionId}`);
            return reject(new Error("Playback Cancelled"));
        }

        // We explicitly cancel all audio at the start of `speakAndWait` (which calls these helpers).
        // So here, we just manage the single HTMLAudioElement for this request.
        // It's crucial not to call `cancelAudio()` again here as it would increment sessionId,
        // invalidating the current request itself.

        const audio = new Audio(url);
        currentFallbackAudio = audio; // Track this specific audio instance
        audio.volume = 1.0;
        
        let hasFinished = false;

        audio.onended = () => {
            if (hasFinished) return;
            hasFinished = true;
            currentFallbackAudio = null; // Clear tracker when done
            resolve();
            console.log(`[Audio] Google Fallback audio finished (Session ID: ${sessionId}).`);
        };

        audio.oncanplaythrough = () => {
            if (hasFinished) return;
            // 2. Pre-Play Session Check: If session changed while loading, abort.
            if (sessionId !== playbackSessionId) {
                audio.pause();
                audio.src = "";
                console.warn(`[Audio] Google Fallback (oncanplaythrough) aborted due to session change. Expected: ${sessionId}, Current: ${playbackSessionId}`);
                return reject(new Error("Playback Cancelled"));
            }
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => { /* Playback initiated */ })
                    .catch(e => {
                        // Autoplay block or other immediate playback error
                        if (hasFinished) return;
                        hasFinished = true;
                        currentFallbackAudio = null; // Clear tracker on error
                        reject(e); 
                        console.error(`[Audio] Google Fallback autoplay blocked or failed (Session ID: ${sessionId}):`, e);
                    });
            }
        };
        
        // Removed unused variable 'e' in error handler
        audio.onerror = () => {
            if (hasFinished) return;
            hasFinished = true;
            currentFallbackAudio = null; // Clear tracker on error
            console.error(`[Audio] HTMLAudioElement error (Session ID: ${sessionId}):`, audio.error);
            reject(new Error(`Audio load or playback error: ${audio.error?.code || 'Unknown'}`));
        };

        // Safety timeout in case oncanplaythrough/onerror/onended never fire
        setTimeout(() => {
            if (!hasFinished) {
                hasFinished = true;
                audio.src = ""; // Stop network request
                currentFallbackAudio = null; // Clear tracker on timeout
                reject(new Error("Audio playback timeout"));
                console.warn(`[Audio] Google Fallback audio timed out (Session ID: ${sessionId}).`);
            }
        }, 8000); // Increased timeout for potentially slow loads
    });
};

/**
 * Attempts to play audio using Google Translate's TTS service and returns a Promise
 * that resolves when the audio finishes or rejects on failure.
 * This is used as a fallback for browsers with poor native TTS.
 */
export const playGoogleFallbackAndWait = async (text: string, lang: string, sessionId: number): Promise<void> => {
  // Check for empty text first
  if (!text.trim()) {
      console.warn(`[Audio] Google Fallback skipped: empty text (Session ID: ${sessionId}).`);
      throw new Error("Empty text"); // Throw error to trigger next fallback if needed
  }
  
  const safeText = text.length > 100 ? text.substring(0, 100) : text;
  const q = encodeURIComponent(safeText);
  const googleLang = sanitizeLangForGoogle(lang);
  
  const candidates = [
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&q=${q}&tl=${googleLang}&idx=0&total=1&textlen=${safeText.length}`,
  ];

  for (const url of candidates) {
      // Session check before each attempt and before awaiting
      if (sessionId !== playbackSessionId) {
          console.warn(`[Audio] Google Fallback (pre-candidate) aborted due to session change. Expected: ${sessionId}, Current: ${playbackSessionId}`);
          throw new Error("Playback Cancelled");
      }
      try {
          await tryPlayUrl(url, sessionId); // This internally checks session and sets currentFallbackAudio
          return; // Success, stop trying
      } catch (e: any) {
          if (e.message === "Playback Cancelled") { // If cancelled by a newer request, re-throw
              throw e; 
          }
          console.warn(`[Audio] Google Fallback candidate failed (Session ID: ${sessionId}): ${url}`, e);
      }
  }

  throw new Error("All Google Fallbacks failed to play audio.");
};

/**
 * Attempts to play audio using the browser's native SpeechSynthesis API and returns a Promise
 * that resolves when the audio finishes or rejects on failure.
 */
export const speakLocalAndWait = (text: string, lang: string, rate: number, pitch: number, voiceURI: string | null, sessionId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Session check before starting native TTS
        if (sessionId !== playbackSessionId) {
            console.warn(`[Audio] Local TTS aborted due to session change. Expected: ${sessionId}, Current: ${playbackSessionId}`);
            return reject(new Error("Playback Cancelled"));
        }
        
        if (!text.trim()) {
            console.warn(`[Audio] Local TTS skipped: empty text (Session ID: ${sessionId}).`);
            return reject(new Error("Empty text"));
        }

        // Immediately cancel only native SpeechSynthesis before starting a new native utterance
        // We do NOT call the global `cancelAudio()` here as it would increment `playbackSessionId`.
        window.speechSynthesis.cancel(); 

        const msg = new SpeechSynthesisUtterance(text);
        // We don't track native utterance globally like fallback audio, as `window.speechSynthesis.cancel()` handles them all.
        // `currentNativeUtterance` was removed as unused.

        msg.lang = lang;
        msg.rate = rate;
        msg.pitch = pitch;
        
        // Find the best matching voice
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            let selectedVoice: SpeechSynthesisVoice | undefined;
            
            if (voiceURI) {
                selectedVoice = voices.find(v => v.voiceURI === voiceURI);
            }
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang === lang);
            }
            if (!selectedVoice) {
                const langPrefix = lang.split('-')[0];
                selectedVoice = voices.find(v => v.lang.startsWith(langPrefix));
            }

            if (selectedVoice) {
                msg.voice = selectedVoice;
                console.log(`[Audio] Using Local TTS voice: ${selectedVoice.name} (${selectedVoice.lang}) (Session ID: ${sessionId})`);
            } else {
                console.warn(`[Audio] No specific local voice found for ${lang} or ${voiceURI}. Using browser default. (Session ID: ${sessionId})`);
            }
        } else {
            console.warn(`[Audio] No SpeechSynthesis voices available locally (Session ID: ${sessionId}).`);
        }

        // Set up event handlers to resolve/reject the promise
        msg.onend = () => {
            // Final session check before resolving to ensure it's still valid
            if (sessionId !== playbackSessionId) { 
                console.warn(`[Audio] Local TTS finished but session changed. Expected: ${sessionId}, Current: ${playbackSessionId}`);
                return reject(new Error("Playback Cancelled"));
            }
            console.log(`[Audio] Local TTS finished (Session ID: ${sessionId}).`);
            resolve();
        };
        // Fix: Correctly access e.error from the SpeechSynthesisErrorEvent object
        msg.onerror = (e: SpeechSynthesisErrorEvent) => {
            console.error(`[Audio] Local TTS Error (Session ID: ${sessionId}):`, e.error);
            reject(new Error(`Local TTS Error: ${e.error}`)); // Reject the promise on error
        };

        window.speechSynthesis.speak(msg);
    });
};

/**
 * The primary asynchronous audio playback function. It intelligently selects between
 * native SpeechSynthesis and a Google Translate API fallback, ensuring audio plays
 * and returns a Promise that resolves upon completion.
 *
 * @param {string} text The text to speak.
 * @param {string} [lang='en-US'] The ISO language code.
 * @param {boolean} [strictMode=false] If true, forces Google fallback on "low-tier" browsers.
 * @param {number} [rate=1] Speech rate.
 * @param {number} [pitch=1] Speech pitch.
 * @param {string | null} [voiceURI=null] Optional: specific voice URI to prefer.
 * @returns {Promise<void>} A promise that resolves when audio finishes, or rejects on unrecoverable error.
 */
export const speakAndWait = async (
    text: string, 
    lang: string = 'en-US', 
    strictMode: boolean = false,
    rate: number = 1,
    pitch: number = 1,
    voiceURI: string | null = null // Pass voiceURI from settings
): Promise<void> => {
  // Capture the current playback session ID at the very start of this request.
  // This ID will be used by internal functions to ensure only the latest intended audio plays.
  const mySessionId = playbackSessionId; 
  
  if (!text.trim()) {
      console.warn(`[Audio] speakAndWait aborted for empty text (Session ID: ${mySessionId}).`);
      throw new Error("Empty text provided for speakAndWait");
  }

  // --- Crucial cancellation logic for single requests ---
  // If this `speakAndWait` is called by a standalone action (e.g., a whiteboard click),
  // it must cancel any *currently playing* audio globally.
  // `cancelAudio()` will increment `playbackSessionId`. This `mySessionId` will be the
  // ID *before* cancellation, which is fine, as subsequent checks will fail,
  // preventing a ghost playback.
  // But for the sake of the `usePresentationTTS` hook, which orchestrates multiple `speakAndWait` calls
  // and has its own `cancelAudio` on state changes, we only explicitly call `cancelAudio()` here
  // if we are certain it's a standalone call (which `speak` handles).
  // The internal `tryPlayUrl` and `speakLocalAndWait` functions will also trigger cancellations
  // or checks. For robustness, it's safer to have UI actions call `cancelAudio()` directly.

  const userOverride = getBrowserTierOverride();
  const isNativeGood = isHighTierBrowser();
  
  // Logic: Force Google if browser is explicitly set to 'low', OR if in strict mode
  // AND the browser is not classified as a 'high-tier' browser for native TTS.
  const shouldForceGoogle = userOverride === 'low' || (strictMode && !isNativeGood);

  if (shouldForceGoogle) {
    try {
        console.log(`[Audio] Attempting Google TTS fallback (Session ID: ${mySessionId})...`);
        await playGoogleFallbackAndWait(text, lang, mySessionId); 
        return; // Successfully played via Google fallback
    } catch (err: any) {
        if (err.message === "Playback Cancelled" || err.message === "Empty text") { 
            console.log(`[Audio] Google Fallback cancelled by newer request or empty text (Session ID: ${mySessionId}).`);
            throw err; 
        }
        console.warn(`[Audio] Google TTS Fallback failed. Trying Local TTS as a secondary fallback (Session ID: ${mySessionId}).`, err);
    }
  }

  // Always try local TTS first (unless forced Google succeeded)
  try {
      console.log(`[Audio] Attempting Local TTS (Session ID: ${mySessionId})...`);
      await speakLocalAndWait(text, lang, rate, pitch, voiceURI, mySessionId);
  } catch (err: any) {
      if (err.message === "Playback Cancelled" || err.message === "Empty text") { 
          console.log(`[Audio] Local TTS cancelled by newer request or empty text (Session ID: ${mySessionId}).`);
          throw err; 
      }
      console.warn(`[Audio] Local TTS Failed or blocked. Trying Google TTS as a final fallback (Session ID: ${mySessionId}).`, err);
      try {
          await playGoogleFallbackAndWait(text, lang, mySessionId);
      } catch (googleErr: any) {
          if (googleErr.message === "Playback Cancelled" || googleErr.message === "Empty text") {
              console.log(`[Audio] Final Google fallback cancelled by newer request or empty text (Session ID: ${mySessionId}).`);
              throw googleErr;
          }
          console.error(`[Audio] All audio playback methods failed (Session ID: ${mySessionId}):`, googleErr);
          throw new Error("Failed to play audio."); // Re-throw if all attempts fail
      }
  }
};

// --- LEGACY FIRE-AND-FORGET `speak` (for whiteboard clicks) ---
// This is kept for compatibility with the existing Whiteboard component,
// which triggers speech on user click and doesn't need to await completion.
// It uses speakAndWait internally but doesn't block execution.
export const speak = (
    text: string, 
    lang: string = 'en-US', 
    strictMode: boolean = false, 
    rate: number = 1, 
    pitch: number = 1
) => {
  // `speakAndWait` will handle the sessionId and cancellation logic internally.
  // We just call it and do not await the promise here.
  speakAndWait(text, lang, strictMode, rate, pitch, null)
    .catch(e => {
        // Only log if it's not a cancellation error or empty text error
        if (e && e.message !== "Playback Cancelled" && e.message !== "Empty text provided for speakAndWait") {
            console.warn("[Audio] Fire-and-forget speak error:", e);
        }
    });
};


// --- DYNAMIC SURVIVAL SCRIPTS (Logic injected into Downloads) ---

// We generate the JS logic dynamically to bake in the sensitivity settings
// This is used for downloaded SVGs and Playgrounds to work offline.
const getCommonLogic = (sensitivity: boolean) => `
  var _isSpeaking = false; 
  var _activeAudioElement = null; 
  var _activeUtterance = null; 
  var _playbackSessionId = 0; // Session ID for survival script

  function _cancelAllAudio() { 
      _playbackSessionId++; // Invalidate pending requests
      if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          _activeUtterance = null;
      }
      if (_activeAudioElement) {
          _activeAudioElement.pause();
          _activeAudioElement.src = "";
          _activeAudioElement = null;
      }
      _isSpeaking = false;
      console.log("Audio cancelled. New ID: " + _playbackSessionId);
  }

  var _strictMode = ${sensitivity};
  var _forceCloud = false; 

  var _voicesLoaded = false;
  if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function() { _voicesLoaded = true; };
  }

  function toggleAudioEngine() {
      _forceCloud = !_forceCloud;
      var status = _forceCloud ? "Cloud (Google)" : "Local (Device)";
      alert("Audio switched to: " + status);
  }

  async function speakSmart(text, lang) { 
      var currentCallSessionId = _playbackSessionId; // Capture ID

      _cancelAllAudio(); // Ensure new ID is set before proceeding

      if (!text.trim()) {
          console.warn("Skipping empty text.");
          return;
      }

      var ua = navigator.userAgent;
      var isEdge = /Edg\\//.test(ua);
      var isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor) && !/OPR\\//.test(ua);
      var isBrave = (navigator.brave && navigator.brave.isBrave);
      var isHighTier = (isEdge || (isChrome && !isBrave));
      
      var hasLocalVoice = true;
      if (lang.indexOf('en') !== 0 && window.speechSynthesis) { 
          var voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
             var prefix = lang.split('-')[0];
             var match = false;
             for(var i=0; i<voices.length; i++) {
                 if(voices[i].lang.indexOf(prefix) === 0) { match = true; break; }
             }
             hasLocalVoice = match;
          }
      }

      var isOnline = navigator.onLine;
      var needsCloud = _forceCloud || (_strictMode && !isHighTier) || !hasLocalVoice;

      try {
          if (isOnline && needsCloud) {
              await tryPlayGoogleAsync(text, lang, currentCallSessionId); 
          } else {
              await speakLocalAsync(text, lang, currentCallSessionId); 
          }
      } catch (e: any) {
          if (e.message === "Playback Cancelled" || e.message === "Timeout" || e.message === "Empty text") {
              console.log("Speak cancelled, timed out, or text was empty.");
          } else {
              console.error("SpeakSmart encountered error:", e);
              // Fallback if initial attempt fails
              try {
                  if (isOnline && !needsCloud) { 
                       await tryPlayGoogleAsync(text, lang, currentCallSessionId);
                  } else { 
                       await speakLocalAsync(text, lang, currentCallSessionId);
                  }
              } catch (fallbackError) {
                  console.error("Fallback audio attempt also failed:", fallbackError);
              }
          }
      } finally {
          // No explicit _isSpeaking = false; here as it's handled by _cancelAllAudio on next speak
      }
  }

  function speakLocalAsync(text, lang, sessionId) {
      return new Promise((resolve, reject) => {
          if (sessionId !== _playbackSessionId) return reject(new Error("Playback Cancelled"));
          window.speechSynthesis.cancel(); 
          
          var msg = new SpeechSynthesisUtterance(text);
          _activeUtterance = msg; 
          msg.lang = lang;
          msg.rate = 0.9;
          msg.onend = function() { 
              if (sessionId === _playbackSessionId) { 
                  _activeUtterance = null;
                  resolve(); 
              } else {
                  reject(new Error("Playback Cancelled"));
              }
          };
          msg.onerror = function(e) { 
              _activeUtterance = null;
              reject(e); 
          };
          window.speechSynthesis.speak(msg);
      });
  }

  function tryPlayGoogleAsync(text, lang, sessionId) {
      return new Promise((resolve, reject) => {
          if (sessionId !== _playbackSessionId) return reject(new Error("Playback Cancelled"));
          
          // CRITICAL: Stop any *currently active* HTML audio if a new one is about to start
          if (_activeAudioElement) { _activeAudioElement.pause(); _activeAudioElement.src = ""; }
          
          var safeText = text.length > 100 ? text.substring(0, 100) : text;
          var q = encodeURIComponent(safeText);
          var gLang = lang;
          if (['zh-CN', 'zh-TW', 'pt-BR', 'en-GB', 'en-US'].indexOf(lang) === -1) {
              gLang = lang.split('-')[0];
          }
          
          var url = "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=" + q + "&tl=" + gLang;
          var audio = new Audio(url);
          _activeAudioElement = audio; 

          function cleanupAndReject(err) {
              if (sessionId === _playbackSessionId) { _activeAudioElement = null; } 
              reject(err);
          }
          
          audio.onended = function() { 
              if (sessionId === _playbackSessionId) { 
                  _activeAudioElement = null;
                  resolve(); 
              } else {
                  reject(new Error("Playback Cancelled"));
              }
          };
          audio.onerror = function(e) { cleanupAndReject(new Error("Audio load error: " + (e.message || "unknown"))); };
          
          var playPromise = audio.play();
          if (playPromise !== undefined) playPromise.catch(cleanupAndReject);
          
          setTimeout(function() {
              if (audio.readyState === 0) cleanupAndReject(new Error("Timeout"));
          }, 4000);
      });
  }
`;

export const getSvgSurvivalScript = (sensitivity: boolean = false) => `
<script type="text/javascript">
<![CDATA[
  ${getCommonLogic(sensitivity)}

  document.addEventListener('click', function(e) {
    var trigger = e.target.closest('.audio-trigger');
    if (trigger) {
        var text = trigger.getAttribute('data-speech');
        var lang = trigger.getAttribute('data-lang') || 'en-US';
        // Auto-detect: if Alt key held, toggle engine temporarily
        if (e.altKey) { _forceCloud = true; }
        speakSmart(text, lang);
        if (e.altKey) { _forceCloud = false; } // Reset after click
    }
  });
]]>
</script>
`;

export const getPlaygroundSurvivalScript = (sensitivity: boolean = false) => `
<script>
  ${getCommonLogic(sensitivity)}

  // Inject UI Toggle for Playgrounds
  window.addEventListener('load', function() {
      var btn = document.createElement('button');
      btn.innerHTML = "🔊 Config";
      btn.style.position = "fixed";
      btn.style.bottom = "10px";
      btn.style.right = "10px";
      btn.style.zIndex = "9999";
      btn.style.padding = "5px 10px";
      btn.style.background = "#eee";
      btn.style.border = "1px solid #ccc";
      btn.style.borderRadius = "4px";
      btn.style.fontSize = "12px";
      btn.style.cursor = "pointer";
      btn.style.opacity = "0.7";
      btn.onclick = toggleAudioEngine;
      document.body.appendChild(btn);
  });

  window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SPEAK') {
          speakSmart(event.data.text, event.data.lang || 'en-US');
      }
  });
</script>
`;
