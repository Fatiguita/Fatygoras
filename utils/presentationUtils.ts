import { NarrativeSegment, WhiteboardData, SlideData } from '../types';

/**
 * Generates a random alphanumeric ID.
 * @returns {string} A unique ID.
 */
export const generateId = (): string => Math.random().toString(36).substr(2, 9);

/**
 * Parses an SVG string to extract narrative segments for presentation.
 * It looks for 'data-speech' attributes (which Fatygoras AI already adds) or 'data-lang',
 * and assigns unique IDs for highlighting during narration.
 *
 * @param {string} rawSvg The raw SVG content.
 * @param {string} defaultTitle A fallback title/explanation to use if no specific speech data is found.
 * @returns {{ content: string; segments: NarrativeSegment[]; fullText: string }} An object containing the processed SVG, extracted segments, and concatenated full text.
 */
export const parseSVGForNarrative = (rawSvg: string, defaultTitle: string): { content: string; segments: NarrativeSegment[]; fullText: string } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, "image/svg+xml");
  
  // Query for elements with either data-speech (Fatygoras standard) or data-lang
  const elements = doc.querySelectorAll('[data-speech], [data-lang]');
  const segments: NarrativeSegment[] = [];
  
  if (elements.length > 0) {
      elements.forEach((el, index) => {
          // 1. Ensure each interactive element has an ID for highlighting.
          // If no ID exists, generate one.
          let id = el.getAttribute('id');
          if (!id) {
              id = `narrative-seg-${index}-${generateId()}`;
              el.setAttribute('id', id);
          }

          // 2. Extract Text: Prefer data-speech, then data-lang, then textContent.
          const text = (el.getAttribute('data-speech') || el.getAttribute('data-lang') || el.textContent || "").trim();
          
          // 3. Extract Language: Prefer data-lang, then lang attribute.
          const lang = el.getAttribute('data-lang') || el.getAttribute('lang') || undefined;

          if (text) {
              segments.push({ id, text, lang });
          }
      });
  } else {
      // Fallback: If no specific speech attributes are found, create a single segment
      // using the default title (typically the whiteboard topic and a snippet of its explanation).
      // This segment will be treated as a "static" slide, taking its duration from `staticSlideDuration`.
      if (defaultTitle) {
          segments.push({ id: 'root-svg', text: defaultTitle, lang: 'en-US' }); // Default to en-US for fallback
      }
  }

  // 3. Serialize the modified SVG (with potentially new IDs) back to a string.
  const serializer = new XMLSerializer();
  let newSvgContent = serializer.serializeToString(doc.documentElement);

  // 4. Force the SVG to be responsive by removing explicit width/height and applying inline styles.
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
            narrativeSegments: segments,
            fullNarrative: fullText || wb.explanation // Prefer generated fullText, fallback to whiteboard explanation
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
    // 1. If it's a fallback segment (meaning the slide itself has no specific audio tags),
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
    return Math.max(durationMs + bufferMs, minDuration); 
};
