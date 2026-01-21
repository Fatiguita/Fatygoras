import { useState, useEffect, useRef } from 'react';
import { NarrativeSegment } from '../types';
import { speak, cancelAudio } from '../services/audioService'; // Import the fire-and-forget 'speak' AND cancelAudio
import { estimateDuration } from '../utils/presentationUtils'; // Import the duration estimator

/**
 * A React hook for managing Text-to-Speech (TTS) playback during a presentation.
 * It handles sequential segment narration using a time-based pacing mechanism.
 * 
 * Features:
 * - Time-based pacing (calculates duration based on word count).
 * - Enforces a minimum slide duration (slideStartTimeRef).
 * - Handles static slides (no text) using a specific duration setting.
 * - Robust cleanup on unmount/pause to prevent audio overlap.
 *
 * @param {NarrativeSegment[]} segments An array of text segments to narrate.
 * @param {boolean} playing A boolean indicating if playback should be active.
 * @param {() => void} onEnd A callback function to be called when all segments have been narrated.
 * @param {object} settings Playback settings.
 * @returns {{ voices: SpeechSynthesisVoice[]; activeId: string | null }}
 */
export const usePresentationTTS = (
    segments: NarrativeSegment[], 
    playing: boolean, 
    onEnd: () => void,
    settings: { 
        rate: number; 
        pitch: number; 
        voiceURI: string | null; 
        pacing: number; 
        minSlideDuration: number; 
        staticSlideDuration: number;
    }
) => {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0); 
    
    // Timer ref to manage timeouts
    const timerRef = useRef<number | null>(null);
    // Track when the current slide started to enforce 'minSlideDuration'
    const slideStartTimeRef = useRef<number>(0); 

    // Load Voices
    useEffect(() => {
        const load = () => setVoices(window.speechSynthesis.getVoices());
        load();
        window.speechSynthesis.onvoiceschanged = load;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    // Reset when slide changes (segments prop changes)
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        cancelAudio();
        setCurrentIndex(0);
        setActiveId(null);
        slideStartTimeRef.current = Date.now(); // Start tracking time for this new slide
    }, [segments]);

    // Core Playback Logic
    useEffect(() => {
        // 1. If not playing or no segments, clean up and do nothing
        if (!playing || segments.length === 0) {
            if (timerRef.current) clearTimeout(timerRef.current);
            cancelAudio();
            return;
        }

        // 2. Check if we have played all segments
        if (currentIndex >= segments.length) {
            // Check if the slide passed too quickly (enforce minSlideDuration)
            const elapsed = Date.now() - slideStartTimeRef.current;
            const remaining = settings.minSlideDuration - elapsed;

            if (remaining > 0) {
                // Wait the remaining time before moving to the next slide
                timerRef.current = window.setTimeout(() => {
                    if (playing) {
                        setActiveId(null);
                        onEnd(); // Go to next slide
                    }
                }, remaining);
            } else {
                // Minimum time met, proceed immediately
                setActiveId(null);
                onEnd(); // Go to next slide
            }
            return;
        }

        const segment = segments[currentIndex];
        if (!segment) {
             setCurrentIndex(prev => prev + 1);
             return;
        }

        // 3. Highlight Visuals
        setActiveId(segment.id);

        // 4. Identify if this is a "Static" slide (fallback text, no interactive audio tags)
        // We use the ID 'root-svg' which is assigned by presentationUtils for fallbacks
        const isStaticSegment = segment.id === 'root-svg';

        // 5. Play Audio (only if not static)
        if (!isStaticSegment) {
            speak(
                segment.text, 
                segment.lang || 'en-US', 
                true, // Strict mode
                settings.rate, 
                settings.pitch
            );
        } else {
            // Ensure silence for static slides
            cancelAudio();
        }

        // 6. Calculate Duration
        // Note: We pass 0 or a small number as minDuration to estimateDuration here, 
        // because we handle the *Slide-Level* minimum at the end of the loop (step 2 above).
        const segmentDuration = estimateDuration(
            segment.text, 
            settings.rate, 
            isStaticSegment, 
            settings.staticSlideDuration,
            1000 // Minimal per-segment floor to prevent glitches
        );
        
        // 7. Calculate Total Wait Time
        // Static slides wait their full duration. Narrative segments add user pacing.
        const totalWait = isStaticSegment 
            ? segmentDuration 
            : segmentDuration + (settings.pacing || 0);

        // 8. Set Timer for Next Segment
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
        }, totalWait);

        // Cleanup: Runs when effect updates (e.g. Pause, Next Segment) or Unmounts
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            // CRITICAL FIX: Always cancel audio on cleanup. 
            // This prevents "orphaned" audio instances when the effect re-runs (e.g. Pause/Play rapid toggle).
            cancelAudio();
        };

    }, [playing, currentIndex, segments, settings, onEnd]);

    return { voices, activeId };
};
