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

        const audio = new Audio(url);
        currentFallbackAudio = audio; // Track this specific audio instance
        audio.volume = 1.0;
        
        let hasFinished = false;

        audio.onended = () => {
            if (hasFinished) return;
            hasFinished = true;
            currentFallbackAudio = null; // Clear tracker when done
            resolve();
        };

        audio.oncanplaythrough = () => {
            if (hasFinished) return;
            // 2. Pre-Play Session Check: If session changed while loading, abort.
            if (sessionId !== playbackSessionId) {
                audio.pause();
                audio.src = "";
                console.warn(`[Audio] Google Fallback (oncanplaythrough) aborted due to session change.`);
                return reject(new Error("Playback Cancelled"));
            }
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => { /* Playback initiated */ })
                    .catch(e => {
                        if (hasFinished) return;
                        hasFinished = true;
                        currentFallbackAudio = null; // Clear tracker on error
                        reject(e); 
                        console.error(`[Audio] Google Fallback autoplay blocked or failed:`, e);
                    });
            }
        };
        
        audio.onerror = () => {
            if (hasFinished) return;
            hasFinished = true;
            currentFallbackAudio = null; // Clear tracker on error
            reject(new Error(`Audio load or playback error: ${audio.error?.code || 'Unknown'}`));
        };

        // Safety timeout
        setTimeout(() => {
            if (!hasFinished) {
                hasFinished = true;
                audio.src = ""; // Stop network request
                currentFallbackAudio = null; // Clear tracker on timeout
                reject(new Error("Audio playback timeout"));
            }
        }, 10000); 
    });
};

/**
 * Splits text into chunks that respect the approximate Google TTS limit (100-200 chars).
 * Splits by logical punctuation where possible.
 */
const chunkTextForTTS = (text: string, maxLength: number = 100): string[] => {
    const chunks: string[] = [];
    // Regex matches sentences or long clauses ending in punctuation, or the end of string
    // Matches: (anything not .!?)+(one or more .!?) OR (anything not .!? at end)
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    
    let currentChunk = "";

    for (const sentence of sentences) {
        // If adding the next sentence keeps us under limit, append it
        if ((currentChunk + sentence).length <= maxLength) {
            currentChunk += sentence;
        } else {
            // Push current chunk if valid
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            
            // If the sentence itself is massive, we must split it further (e.g. by commas)
            if (sentence.length > maxLength) {
                const subParts = sentence.match(/[^,]+,|[^,]+$/g) || [sentence];
                currentChunk = "";
                
                for (const part of subParts) {
                     if ((currentChunk + part).length <= maxLength) {
                         currentChunk += part;
                     } else {
                         if (currentChunk.trim()) chunks.push(currentChunk.trim());
                         
                         // If even the sub-part is too long, hard split
                         if (part.length > maxLength) {
                             let remaining = part;
                             while (remaining.length > 0) {
                                 chunks.push(remaining.substring(0, maxLength).trim());
                                 remaining = remaining.substring(maxLength);
                             }
                             currentChunk = "";
                         } else {
                             currentChunk = part;
                         }
                     }
                }
            } else {
                currentChunk = sentence;
            }
        }
    }
    
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
};

/**
 * Attempts to play audio using Google Translate's TTS service.
 * Supports long text by chunking and playing sequentially.
 */
export const playGoogleFallbackAndWait = async (text: string, lang: string, sessionId: number): Promise<void> => {
  if (!text.trim()) {
      console.warn(`[Audio] Google Fallback skipped: empty text (Session ID: ${sessionId}).`);
      throw new Error("Empty text");
  }

  // Break text into safe chunks to avoid API limits/cutoff
  const chunks = chunkTextForTTS(text, 100); 
  const googleLang = sanitizeLangForGoogle(lang);

  console.log(`[Audio] Google Fallback: Playing ${chunks.length} chunks (Session ID: ${sessionId})`);

  for (const chunk of chunks) {
      // 1. Check session before processing chunk
      if (sessionId !== playbackSessionId) throw new Error("Playback Cancelled");
      
      const q = encodeURIComponent(chunk);
      
      // Try reliable endpoints
      const candidates = [
          `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
          `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
      ];

      let chunkSuccess = false;
      for (const url of candidates) {
          if (sessionId !== playbackSessionId) throw new Error("Playback Cancelled");
          try {
              await tryPlayUrl(url, sessionId);
              chunkSuccess = true;
              break; // Chunk played successfully, move to next chunk
          } catch (e: any) {
              if (e.message === "Playback Cancelled") throw e;
              // Continue to next candidate
          }
      }

      if (!chunkSuccess) {
          console.warn(`[Audio] Failed to play chunk: "${chunk.substring(0, 20)}..."`);
          // We don't throw immediately to try playing remaining chunks if one fails,
          // but arguably we should stop. For now, let's keep trying to be resilient.
      }
  }
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
            return reject(new Error("Empty text"));
        }

        // Immediately cancel only native SpeechSynthesis before starting a new native utterance
        window.speechSynthesis.cancel(); 

        const msg = new SpeechSynthesisUtterance(text);
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
                console.log(`[Audio] Using Local TTS voice: ${selectedVoice.name} (${selectedVoice.lang})`);
            }
        }

        msg.onend = () => {
            if (sessionId !== playbackSessionId) { 
                return reject(new Error("Playback Cancelled"));
            }
            resolve();
        };
        
        msg.onerror = (e: SpeechSynthesisErrorEvent) => {
            console.error(`[Audio] Local TTS Error:`, e.error);
            reject(new Error(`Local TTS Error: ${e.error}`)); 
        };

        window.speechSynthesis.speak(msg);
    });
};

/**
 * The primary asynchronous audio playback function.
 */
export const speakAndWait = async (
    text: string, 
    lang: string = 'en-US', 
    strictMode: boolean = false,
    rate: number = 1,
    pitch: number = 1,
    voiceURI: string | null = null
): Promise<void> => {
  const mySessionId = playbackSessionId; 
  
  if (!text.trim()) {
      throw new Error("Empty text provided for speakAndWait");
  }

  const userOverride = getBrowserTierOverride();
  const isNativeGood = isHighTierBrowser();
  const shouldForceGoogle = userOverride === 'low' || (strictMode && !isNativeGood);

  if (shouldForceGoogle) {
    try {
        console.log(`[Audio] Attempting Google TTS fallback (Session ID: ${mySessionId})...`);
        await playGoogleFallbackAndWait(text, lang, mySessionId); 
        return; 
    } catch (err: any) {
        if (err.message === "Playback Cancelled" || err.message === "Empty text") throw err; 
        console.warn(`[Audio] Google TTS Fallback failed. Trying Local TTS.`, err);
    }
  }

  // Always try local TTS first (unless forced Google succeeded)
  try {
      console.log(`[Audio] Attempting Local TTS (Session ID: ${mySessionId})...`);
      await speakLocalAndWait(text, lang, rate, pitch, voiceURI, mySessionId);
  } catch (err: any) {
      if (err.message === "Playback Cancelled" || err.message === "Empty text") throw err;
      console.warn(`[Audio] Local TTS Failed. Trying Google TTS fallback.`, err);
      try {
          await playGoogleFallbackAndWait(text, lang, mySessionId);
      } catch (googleErr: any) {
          if (googleErr.message === "Playback Cancelled" || googleErr.message === "Empty text") throw googleErr;
          console.error(`[Audio] All audio playback methods failed.`, googleErr);
          throw new Error("Failed to play audio."); 
      }
  }
};

// --- LEGACY FIRE-AND-FORGET `speak` ---
export const speak = (
    text: string, 
    lang: string = 'en-US', 
    strictMode: boolean = false, 
    rate: number = 1, 
    pitch: number = 1
) => {
  speakAndWait(text, lang, strictMode, rate, pitch, null)
    .catch(e => {
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
      } catch (e) {
         // Fallback handling simplified for embedded script
         console.error(e);
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

  // Simplified Google player for offline script (no complex chunking to save space, relies on short texts usually found in SVGs)
  function tryPlayGoogleAsync(text, lang, sessionId) {
      return new Promise((resolve, reject) => {
          if (sessionId !== _playbackSessionId) return reject(new Error("Playback Cancelled"));
          
          if (_activeAudioElement) { _activeAudioElement.pause(); _activeAudioElement.src = ""; }
          
          var safeText = text.substring(0, 100); // Keep simple truncation for offline survival script to ensure high success rate
          var q = encodeURIComponent(safeText);
          var gLang = lang.split('-')[0];
          
          var url = "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=" + q + "&tl=" + gLang;
          var audio = new Audio(url);
          _activeAudioElement = audio; 
          
          audio.onended = function() { 
              if (sessionId === _playbackSessionId) { 
                  _activeAudioElement = null;
                  resolve(); 
              }
          };
          audio.onerror = function(e) { reject(new Error("Audio load error")); };
          audio.play();
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
        if (e.altKey) { _forceCloud = true; }
        speakSmart(text, lang);
        if (e.altKey) { _forceCloud = false; } 
    }
  });
]]>
</script>
`;

export const getPlaygroundSurvivalScript = (sensitivity: boolean = false) => `
<script>
  ${getCommonLogic(sensitivity)}

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
