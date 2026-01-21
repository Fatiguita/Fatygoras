import { NarrativeSegment, WhiteboardData, SlideData } from '../types';

/**
 * Generates a random alphanumeric ID.
 * @returns {string} A unique ID.
 */
export const generateId = (): string => Math.random().toString(36).substr(2, 9);

/**
 * Parses an SVG string to extract narrative segments for presentation.
 * Uses DOMParser (XML) to find specific nodes. 
 * Includes robustness fixes for malformed XML entities (e.g. unescaped '&').
 *
 * @param {string} rawSvg The raw SVG content.
 * @param {string} defaultTitle A fallback title/explanation to use if no specific speech data is found.
 * @returns {{ content: string; segments: NarrativeSegment[]; fullText: string }} An object containing the processed SVG, extracted segments, and concatenated full text.
 */
export const parseSVGForNarrative = (rawSvg: string, defaultTitle: string): { content: string; segments: NarrativeSegment[]; fullText: string } => {
  // 1. Sanitize the SVG string before strict XML parsing
  // The AI often outputs raw '&' (ampersand) which is valid in HTML but invalid in XML (must be &amp;).
  // This regex finds '&' that is NOT followed by a valid XML entity sequence (e.g., &#x...; or &name;).
  const sanitizedSvg = rawSvg.replace(/&(?!(?:[a-z]+|#[0-9]+|#x[0-9a-f]+);)/gi, '&amp;');

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedSvg, "image/svg+xml");
  
  // 2. Check for Parser Errors
  // If the XML parser encountered an error, it inserts a <parsererror> element.
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
      console.warn("Presentation Mode: SVG XML Parsing failed (likely bad entities). Falling back to raw HTML display.", parserError.textContent);
      
      // Fallback Strategy:
      // If parsing fails, we cannot extract individual segments, but we still want to display the SVG.
      // We'll return the *sanitized* SVG content directly for React to render (it's more forgiving via dangerouslySetInnerHTML),
      // and create a single 'root-svg' segment for the entire slide's default narration.
      let responsiveFallbackSvgContent = sanitizedSvg
          .replace(/width=["']?(\d+(\.\d+)?)["']?/gi, '')
          .replace(/height=["']?(\d+(\.\d+)?)["']?/gi, '')
          .replace(/<svg/i, '<svg style="width:100%; height:100%; display:block;"');

      const fallbackSegment: NarrativeSegment = { id: 'root-svg', text: defaultTitle, lang: 'en-US' };
      return {
          content: responsiveFallbackSvgContent,
          segments: [fallbackSegment],
          fullText: defaultTitle // The default narrative for this unparseable slide
      };
  }

  // 3. Normal Extraction Logic (if parsing was successful)
  // Query for elements that contain speech data (Fatygoras AI uses 'data-speech' primarily).
  const elements = doc.querySelectorAll('[data-speech], [data-lang]');
  const segments: NarrativeSegment[] = [];
  
  if (elements.length > 0) {
      elements.forEach((el, index) => {
          // Ensure each interactive element has an ID for highlighting.
          // If no ID exists, generate one to ensure it can be targeted by CSS/JS.
          let id = el.getAttribute('id');
          if (!id) {
              id = `narrative-seg-${index}-${generateId()}`;
              el.setAttribute('id', id);
          }

          // Extract Text: Prefer `data-speech`, then `data-lang`, then the element's `textContent`.
          const text = (el.getAttribute('data-speech') || el.getAttribute('data-lang') || el.textContent || "").trim();
          
          // Extract Language: Prefer `data-lang`, then the standard `lang` attribute.
          const lang = el.getAttribute('data-lang') || el.getAttribute('lang') || undefined;

          if (text) { // Only add if there's actual text to speak
              segments.push({ id, text, lang });
          }
      });
  } else {
      // Fallback for SVGs that parse correctly but have NO `data-speech` or `data-lang` attributes.
      // In this case, we treat the entire slide as a "static" slide,
      // using the provided `defaultTitle` as its narrative, which will take the `staticSlideDuration`.
      if (defaultTitle) {
          segments.push({ id: 'root-svg', text: defaultTitle, lang: 'en-US' }); // Default to en-US for fallback
      }
  }

  // 4. Serialize the potentially modified SVG (with new IDs) back to a string.
  const serializer = new XMLSerializer();
  let newSvgContent = serializer.serializeToString(doc.documentElement);

  // 5. Force the SVG to be responsive for display.
  // Removes explicit width/height attributes and applies inline styles for flex behavior.
  newSvgContent = newSvgContent
      .replace(/width=["']?(\d+(\.\d+)?)["']?/gi, '')
      .replace(/height=["']?(\d+(\.\d+)?)["']?/gi, '')
      .replace(/<svg/i, '<svg style="width:100%; height:100%; display:block;"');

  return {
      content: newSvgContent,
      segments,
      fullText: segments.map(s => s.text).join(' . ') // Concatenate all segment texts for the full narrative display.
  };
};

/**
 * Converts an array of Fatygoras's WhiteboardData objects into SlideData objects
 * suitable for the presentation mode.
 *
 * @param {WhiteboardData[]} whiteboards An array of whiteboard data from the main app.
 * @returns {SlideData[]} An array of SlideData objects.
 */
export const convertWhiteboardsToSlides = (whiteboards: WhiteboardData[]): SlideData[] => {
    return whiteboards.map(wb => {
        // Use the whiteboard's topic and a snippet of its explanation as the default title
        // if no specific narrative segments are found within the SVG itself.
        const defaultNarrative = `${wb.topic}. ${wb.explanation.substring(0, 100)}${wb.explanation.length > 100 ? '...' : ''}`;
        const { content, segments, fullText } = parseSVGForNarrative(wb.svgContent, defaultNarrative);
        return {
            id: wb.id,
            name: wb.topic, // Use whiteboard topic as slide name
            svgContent: content,
            // The `narrativeSegments` here will either be extracted from the SVG or be a single 'root-svg' fallback.
            narrativeSegments: segments,
            // The `fullNarrative` for display should prefer the concatenated segments, but fallback to original explanation.
            fullNarrative: fullText.trim() || wb.explanation 
        };
    });
};

/**
 * Estimates the duration (in milliseconds) a given text would take to speak at a certain rate.
 * This is used for time-based pacing in the presentation mode.
 *
 * @param {string} text The text content to estimate duration for.
 * @param {number} [rate=1] The speech rate (e.g., 1 for normal, 0.5 for half speed).
 * @param {boolean} [isFallback=false] If true, this segment is part of a "static" slide (no specific audio tags).
 * @param {number} [staticDuration=10000] The user-defined duration for static slides (in ms).
 * @param {number} [minDuration=5000] The user-defined minimum duration for any slide (in ms).
 * @returns {number} The estimated duration in milliseconds.
 */
export const estimateDuration = (
    text: string, 
    rate: number = 1, 
    isFallback: boolean = false, 
    staticDuration: number = 10000, 
    minDuration: number = 5000
): number => {
    // 1. If it's a fallback segment (meaning the slide itself has no specific audio tags extracted),
    // its duration is solely determined by the user's `staticDuration` setting.
    if (isFallback) {
        return staticDuration;
    }

    // 2. For segments with actual text, calculate natural speaking duration.
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    
    // Baseline speaking speed: ~150 Words Per Minute (WPM) for average English.
    const baseWPM = 150; 
    
    // Adjust WPM based on user's `rate` setting
    const effectiveWPM = baseWPM * rate;
    
    // Calculate raw duration in milliseconds
    let durationMs = (wordCount / effectiveWPM) * 60 * 1000;
    
    // 3. Apply a minimum floor duration to ensure slides don't flash too quickly.
    // Also add a small buffer for audio loading/processing latency.
    const bufferMs = 500; // Additional buffer for audio initiation
    
    // The final duration for a segment with text is the maximum of:
    //    (calculated_duration + buffer)  AND  user_defined_minDuration.
    // Note: minDuration here acts as a floor for *individual segment* durations,
    // not the overall slide duration (which is handled in usePresentationTTS).
    return Math.max(durationMs + bufferMs, minDuration); 
};
