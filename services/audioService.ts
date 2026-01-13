
const STORAGE_KEY_BROWSER_OVERRIDE = 'fatygoras_audio_tier_override';

const sanitizeLangForGoogle = (isoLang: string): string => {
    if (['zh-CN', 'zh-TW', 'pt-BR', 'en-GB', 'en-US'].includes(isoLang)) {
        return isoLang;
    }
    return isoLang.split('-')[0];
};

export const getDetectedBrowserName = (): string => {
    if (typeof navigator === 'undefined') return "Unknown";
    const ua = navigator.userAgent;

    if (/OPR\//.test(ua)) return "Opera";
    if (/Edg\//.test(ua)) return "Microsoft Edge";
    // Brave usually hides itself, but if we detected it via object or heuristic
    if ((navigator as any).brave && (navigator as any).brave.isBrave) return "Brave";

    if (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor)) return "Google Chrome";
    if (/Firefox/.test(ua)) return "Firefox";
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";

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
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor) && !/OPR\//.test(ua);

    // Brave detection (Brave often mimics Chrome exactly, so we might miss it without the property check)
    const isBrave = (navigator as any).brave && (navigator as any).brave.isBrave;

    // Only Edge and pure Chrome are trusted for High Quality Native TTS by default
    return !!(isEdge || (isChrome && !isBrave));
};

const tryPlayUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.volume = 1.0;

        let hasResolved = false;

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
                        reject(e);
                    });
            }
        };

        audio.onerror = (e) => {
            if (hasResolved) return;
            hasResolved = true;
            const errCode = audio.error?.code;
            reject(new Error(`Audio load error: ${errCode}`));
        };

        setTimeout(() => {
            if (!hasResolved) {
                hasResolved = true;
                audio.src = "";
                reject(new Error("Timeout"));
            }
        }, 6000);
    });
};

export const playGoogleFallback = async (text: string, lang: string) => {
    const safeText = text.length > 100 ? text.substring(0, 100) : text;
    const q = encodeURIComponent(safeText);
    const googleLang = sanitizeLangForGoogle(lang);

    const candidates = [
        `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
        `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&q=${q}&tl=${googleLang}&idx=0&total=1&textlen=${safeText.length}`,
        `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${googleLang}`,
    ];

    for (const url of candidates) {
        try {
            await tryPlayUrl(url);
            console.log(`[Audio] Success with endpoint: ${url}`);
            return;
        } catch (e) {
            console.warn(`[Audio] Failed candidate: ${url}`, e);
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

export const SVG_SURVIVAL_SCRIPT = `
<script type="text/javascript">
<![CDATA[
  document.addEventListener('click', function(e) {
    const trigger = e.target.closest('.audio-trigger');
    if (trigger) {
        const text = trigger.getAttribute('data-speech');
        const lang = trigger.getAttribute('data-lang') || 'en-US';
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = lang;
        window.speechSynthesis.speak(msg);
    }
  });
]]>
</script>
`;

export const PLAYGROUND_SURVIVAL_SCRIPT = `
<script>
  window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SPEAK') {
          window.speechSynthesis.cancel();
          const msg = new SpeechSynthesisUtterance(event.data.text);
          msg.lang = event.data.lang || 'en-US';
          window.speechSynthesis.speak(msg);
      }
  });
</script>
`;

