
const STORAGE_KEY_BROWSER_OVERRIDE = 'fatygoras_audio_tier_override';

// Helper to map strict ISO codes (ja-JP) to Google Translate friendly codes (ja)
const sanitizeLangForGoogle = (isoLang: string): string => {
    // Special cases where Google uses full code
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

// Internal helper to try playing a URL
const tryPlayUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        // Important: Leave crossOrigin undefined to treat as opaque resource
        audio.volume = 1.0;
        
        let hasResolved = false;

        // 'canplaythrough' implies the browser has buffered enough to start
        audio.oncanplaythrough = () => {
            if (hasResolved) return;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        hasResolved = true;
                        resolve();
                    })
                    .catch(e => {
                        hasResolved = true;
                        reject(e); // Autoplay block or other playback error
                    });
            }
        };
        
        // Error handler
        audio.onerror = () => {
            if (hasResolved) return;
            hasResolved = true;
            const errCode = audio.error?.code;
            reject(new Error(`Audio load error: ${errCode}`));
        };

        // Safety timeout
        setTimeout(() => {
            if (!hasResolved) {
                hasResolved = true;
                // Clean up to stop loading
                audio.src = "";
                reject(new Error("Timeout"));
            }
        }, 6000);
    });
};

export const playGoogleFallback = async (text: string, lang: string) => {
  // 1. Strict Truncation
  const safeText = text.length > 100 ? text.substring(0, 100) : text;
  const q = encodeURIComponent(safeText);
  const googleLang = sanitizeLangForGoogle(lang);
  
  // 2. Endpoint Cascade
  const candidates = [
      // API subdomain (often more permissive)
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
      // Secondary options
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&q=${q}&tl=${googleLang}&idx=0&total=1&textlen=${safeText.length}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
  ];

  for (const url of candidates) {
      try {
          await tryPlayUrl(url);
          console.log(`[Audio] Success with endpoint: ${url}`);
          return; // Success
      } catch (e) {
          console.warn(`[Audio] Failed candidate: ${url}`, e);
          // Continue to next candidate
      }
  }

  throw new Error("All Google Fallbacks failed.");
};

export const speak = (text: string, lang: string = 'en-US', strictMode: boolean = false) => {
  window.speechSynthesis.cancel(); 

  const userOverride = getBrowserTierOverride();
  const isNativeGood = isHighTierBrowser();
  
  // LOGIC: 
  // 1. If override is 'low', force Google.
  // 2. If Auto + StrictMode + Browser is NOT High Tier (e.g. Brave/Firefox), force Google.
  const shouldForceGoogle = userOverride === 'low' || (strictMode && !isNativeGood);

  if (shouldForceGoogle) {
    playGoogleFallback(text, lang)
        .catch(err => {
            console.error("Google TTS Fallback Failed. Reverting to Local.", err);
            speakLocal(text, lang);
        });
    return;
  }

  speakLocal(text, lang);
};

const speakLocal = (text: string, lang: string) => {
  console.log(`[Audio] Using Local TTS (${lang})`);
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang;
  
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
      const bestVoice = voices.find(v => v.lang === lang) || 
                        voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (bestVoice) msg.voice = bestVoice;
  }

  msg.rate = 0.9; 
  window.speechSynthesis.speak(msg);
};

// --- DYNAMIC SURVIVAL SCRIPTS (Logic injected into Downloads) ---

// We generate the JS logic dynamically to bake in the sensitivity settings
const getCommonLogic = (sensitivity: boolean) => `
  var _isSpeaking = false;
  // This is baked in at download time
  var _strictMode = ${sensitivity};
  var _forceCloud = false; // User toggle

  // Detect missing voices
  var _voicesLoaded = false;
  if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function() { _voicesLoaded = true; };
  }

  function toggleAudioEngine() {
      _forceCloud = !_forceCloud;
      var status = _forceCloud ? "Cloud (Google)" : "Local (Device)";
      alert("Audio switched to: " + status);
  }

  function speakSmart(text, lang) {
      if(_isSpeaking) window.speechSynthesis.cancel();
      _isSpeaking = true;

      // 1. Browser Detection
      var ua = navigator.userAgent;
      var isEdge = /Edg\\//.test(ua);
      var isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor) && !/OPR\\//.test(ua);
      var isBrave = (navigator.brave && navigator.brave.isBrave);
      var isHighTier = (isEdge || (isChrome && !isBrave));
      
      // 2. Check Local Availability
      // If we aren't English, check if the device actually has the voice
      var hasLocalVoice = true;
      if (lang.indexOf('en') !== 0 && window.speechSynthesis) {
          var voices = window.speechSynthesis.getVoices();
          // If voices are loaded, check. 
          if (voices.length > 0) {
             var prefix = lang.split('-')[0];
             var match = false;
             for(var i=0; i<voices.length; i++) {
                 if(voices[i].lang.indexOf(prefix) === 0) { match = true; break; }
             }
             hasLocalVoice = match;
          }
      }

      // 3. Logic Matrix
      var isOnline = navigator.onLine;
      
      // Needs Cloud if:
      // a) User toggled manual override (_forceCloud)
      // b) Strict Mode is ON AND Browser is Low Tier
      // c) Device literally lacks the voice (hasLocalVoice == false)
      var needsCloud = _forceCloud || (_strictMode && !isHighTier) || !hasLocalVoice;

      if (isOnline && needsCloud) {
          tryPlayGoogle(text, lang);
      } else {
          speakLocal(text, lang);
      }
  }

  function speakLocal(text, lang) {
      var msg = new SpeechSynthesisUtterance(text);
      msg.lang = lang;
      msg.rate = 0.9;
      msg.onend = function() { _isSpeaking = false; };
      window.speechSynthesis.speak(msg);
  }

  function tryPlayGoogle(text, lang) {
      var safeText = text.length > 100 ? text.substring(0, 100) : text;
      var q = encodeURIComponent(safeText);
      var gLang = lang;
      if (['zh-CN', 'zh-TW', 'pt-BR', 'en-GB', 'en-US'].indexOf(lang) === -1) {
          gLang = lang.split('-')[0];
      }
      
      var url = "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=" + q + "&tl=" + gLang;
      var audio = new Audio(url);
      audio.volume = 1.0;
      
      function fallback() {
          console.warn("Google TTS failed in standalone. Switching to Local.");
          speakLocal(text, lang);
      }

      audio.onerror = fallback;
      var p = audio.play();
      if (p !== undefined) p.catch(fallback);
      
      setTimeout(function() {
          if (audio.readyState === 0) fallback();
      }, 4000);
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
