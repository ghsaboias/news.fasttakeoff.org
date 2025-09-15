'use client';

import { cn } from '@/lib/utils';
import React, { useCallback, useMemo, useRef, memo, useEffect } from 'react';

interface TimelineProps {
  startTime: Date;
  endTime: Date;
  currentStart: Date;
  currentEnd: Date;
  onTimeRangeChange: (start: Date, end: Date) => void;
  className?: string;
  disabled?: boolean;
}

// Simple hook for instant DOM updates
const useInstantSlider = (
  onTimeRangeChange: (start: Date, end: Date) => void,
  timeStamps: { start: number; end: number; currentStart: number; currentEnd: number },
  totalDuration: number
) => {
  const rangeIndicatorRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);
  const sliderInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Instant slider handler - update DOM immediately, throttle state updates
  const handleInstantChange = useCallback((value: number) => {
    // Calculate positions
    const windowWidth = (timeStamps.currentEnd - timeStamps.currentStart) / totalDuration * 100;
    const newStartPercent = value;
    const newEndPercent = value + windowWidth;

    // Update DOM instantly
    if (rangeIndicatorRef.current) {
      rangeIndicatorRef.current.style.left = `${newStartPercent}%`;
    }
    if (startHandleRef.current) {
      startHandleRef.current.style.left = `${newStartPercent}%`;
    }
    if (endHandleRef.current) {
      endHandleRef.current.style.left = `${newEndPercent}%`;
    }

    // Throttle state updates
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const windowSize = timeStamps.currentEnd - timeStamps.currentStart;
      const newStartTime = new Date(timeStamps.start + (value * totalDuration / 100));
      const newEndTime = new Date(newStartTime.getTime() + windowSize);
      if (newEndTime.getTime() <= timeStamps.end) {
        onTimeRangeChange(newStartTime, newEndTime);
      }
    }, 16);
  }, [onTimeRangeChange, timeStamps, totalDuration]);

  // Sync slider value when props change (but not during user interaction)
  useEffect(() => {
    const currentPercent = (timeStamps.currentStart - timeStamps.start) / (timeStamps.end - timeStamps.start) * 100;
    if (sliderInputRef.current && document.activeElement !== sliderInputRef.current) {
      sliderInputRef.current.value = currentPercent.toString();
    }
  }, [timeStamps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    handleInstantChange,
    rangeIndicatorRef,
    startHandleRef,
    endHandleRef,
    sliderInputRef
  };
};

// Memoized marker components to prevent re-renders
const DayMarker = memo(({ marker }: { marker: { date: Date; position: number; dateStr: string } }) => (
  <div
    className="absolute flex flex-col items-center"
    style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
  >
    <div className="text-xs text-muted-foreground font-medium">
      {marker.dateStr}
    </div>
    <div className="w-px h-2 bg-border"></div>
  </div>
));
DayMarker.displayName = 'DayMarker';

const TimeMarker = memo(({ marker }: { marker: { position: number; timeStr: string } }) => (
  <div
    className="absolute top-0 bottom-0 flex flex-col items-center"
    style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
  >
    <div className="w-px h-full bg-border/50"></div>
    <div className="text-xs text-muted-foreground/70 mt-1">
      {marker.timeStr}
    </div>
  </div>
));
TimeMarker.displayName = 'TimeMarker';

// Custom hook for optimized calculations
const useTimelineCalculations = (startTime: Date, endTime: Date, currentStart: Date, currentEnd: Date) => {
  // Memoize timestamp calculations to avoid repeated .getTime() calls
  const timeStamps = useMemo(() => ({
    start: startTime.getTime(),
    end: endTime.getTime(),
    currentStart: currentStart.getTime(),
    currentEnd: currentEnd.getTime(),
  }), [startTime, endTime, currentStart, currentEnd]);

  const totalDuration = useMemo(() =>
    timeStamps.end - timeStamps.start
  , [timeStamps.start, timeStamps.end]);

  // Optimize percentage calculations with cached division
  const percentageCalculations = useMemo(() => {
    const totalDurationInverse = 100 / totalDuration; // Pre-calculate division

    return {
      currentStartPercent: (timeStamps.currentStart - timeStamps.start) * totalDurationInverse,
      currentEndPercent: (timeStamps.currentEnd - timeStamps.start) * totalDurationInverse,
      totalDurationInverse,
    };
  }, [timeStamps, totalDuration]);

  return { timeStamps, totalDuration, ...percentageCalculations };
};

// Optimized marker generation with string pre-formatting
const useOptimizedMarkers = (startTime: Date, endTime: Date, totalDuration: number, totalDurationInverse: number) => {
  // Memoize day markers with pre-formatted strings
  const dayMarkers = useMemo(() => {
    const markers = [];
    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);

    // If startTime is not at beginning of day, start from next day
    if (dayStart.getTime() < startTime.getTime()) {
      dayStart.setDate(dayStart.getDate() + 1);
    }

    const startTimeStamp = startTime.getTime();
    const endTimeStamp = endTime.getTime();

    for (let currentDay = new Date(dayStart); currentDay.getTime() <= endTimeStamp; currentDay.setDate(currentDay.getDate() + 1)) {
      const position = (currentDay.getTime() - startTimeStamp) * totalDurationInverse;

      if (position >= 0 && position <= 100) {
        markers.push({
          date: new Date(currentDay),
          position,
          // Pre-format date string to avoid repeated formatting
          dateStr: currentDay.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        });
      }
    }

    return markers;
  }, [startTime, endTime, totalDurationInverse]);

  // Memoize time markers with pre-formatted strings
  const timeMarkers = useMemo(() => {
    const markers = [];
    const sixHours = 6 * 60 * 60 * 1000;

    // Start from the first 6-hour boundary after startTime
    const startHour = Math.ceil(startTime.getHours() / 6) * 6;
    const markerStart = new Date(startTime);
    markerStart.setHours(startHour, 0, 0, 0);

    const startTimeStamp = startTime.getTime();
    let currentMarker = new Date(markerStart);

    while (currentMarker.getTime() <= endTime.getTime()) {
      const position = (currentMarker.getTime() - startTimeStamp) * totalDurationInverse;

      if (position >= 0 && position <= 100) {
        markers.push({
          position,
          // Pre-format time string
          timeStr: `${currentMarker.getHours().toString().padStart(2, '0')}:00`
        });
      }
      currentMarker = new Date(currentMarker.getTime() + sixHours);
    }

    return markers;
  }, [startTime, endTime, totalDurationInverse]);

  return { dayMarkers, timeMarkers };
};

export const Timeline: React.FC<TimelineProps> = memo(({
  startTime,
  endTime,
  currentStart,
  currentEnd,
  onTimeRangeChange,
  className,
  disabled = false,
}) => {
  // Cache DOM references to avoid repeated queries
  const timelineTrackRef = useRef<HTMLDivElement>(null);

  const {
    timeStamps,
    totalDuration,
    currentStartPercent,
    currentEndPercent,
    totalDurationInverse
  } = useTimelineCalculations(startTime, endTime, currentStart, currentEnd);

  const { dayMarkers, timeMarkers } = useOptimizedMarkers(
    startTime,
    endTime,
    totalDuration,
    totalDurationInverse
  );

  // Use instant DOM updates for zero-lag performance
  const {
    handleInstantChange,
    rangeIndicatorRef,
    startHandleRef,
    endHandleRef,
    sliderInputRef
  } = useInstantSlider(
    onTimeRangeChange,
    timeStamps,
    totalDuration
  );

  // Memoize formatting functions with closures
  const formatters = useMemo(() => ({
    formatTime: (date: Date) => date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    formatDate: (date: Date) => date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }), []);

  // Pre-calculate constants to avoid repeated calculations
  const constants = useMemo(() => ({
    minWindow: 5 * 60 * 1000, // 5 minutes
    totalSpanDays: Math.round(totalDuration / (1000 * 60 * 60 * 24)),
    totalSpanHours: Math.round((totalDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    currentWindowMinutes: Math.round((timeStamps.currentEnd - timeStamps.currentStart) / (1000 * 60)),
    currentWindowPercentage: Math.round(((timeStamps.currentEnd - timeStamps.currentStart) / totalDuration) * 100)
  }), [totalDuration, timeStamps.currentEnd, timeStamps.currentStart]);

  // Instant slider handler for zero-lag performance
  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const value = parseFloat(event.target.value);
    handleInstantChange(value);
  }, [handleInstantChange, disabled]);

  // Simplified drag handlers for immediate response
  const createDragHandler = useCallback((isStartHandle: boolean) => {
    return (event: React.MouseEvent) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const timelineTrack = timelineTrackRef.current;
      if (!timelineTrack) return;

      const rect = timelineTrack.getBoundingClientRect();

      let rafId: number | null = null;
      let lastArgs: { start?: Date; end?: Date } | null = null;

      const flush = () => {
        if (!lastArgs) return;
        const { start, end } = lastArgs;
        if (isStartHandle && start) onTimeRangeChange(start, currentEnd);
        if (!isStartHandle && end) onTimeRangeChange(currentStart, end);
        rafId = null;
      };

      const startDrag = (e: MouseEvent) => {
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const newTime = new Date(startTime.getTime() + (percentage / 100) * totalDuration);

        const minWindow = 5 * 60 * 1000; // 5 minutes

        // Instant DOM updates for handles and active range to avoid visual lag
        const inv = 100 / totalDuration;

        if (isStartHandle) {
          const maxStart = new Date(currentEnd.getTime() - minWindow);
          if (newTime >= startTime && newTime <= maxStart) {
            lastArgs = { start: newTime };
            const newStartPercent = (newTime.getTime() - startTime.getTime()) * inv;
            if (startHandleRef.current) startHandleRef.current.style.left = `${newStartPercent}%`;
            if (rangeIndicatorRef.current) {
              rangeIndicatorRef.current.style.left = `${newStartPercent}%`;
              const width = Math.max(0, currentEndPercent - newStartPercent);
              rangeIndicatorRef.current.style.width = `${width}%`;
            }
          }
        } else {
          const minEnd = new Date(currentStart.getTime() + minWindow);
          if (newTime <= endTime && newTime >= minEnd) {
            lastArgs = { end: newTime };
            const newEndPercent = (newTime.getTime() - startTime.getTime()) * inv;
            if (endHandleRef.current) endHandleRef.current.style.left = `${newEndPercent}%`;
            if (rangeIndicatorRef.current) {
              const width = Math.max(0, newEndPercent - currentStartPercent);
              rangeIndicatorRef.current.style.width = `${width}%`;
            }
          }
        }

        if (rafId == null) {
          rafId = window.requestAnimationFrame(flush);
        }
      };

      const stopDrag = () => {
        document.removeEventListener('mousemove', startDrag);
        document.removeEventListener('mouseup', stopDrag);
        if (rafId != null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
      };

      document.addEventListener('mousemove', startDrag);
      document.addEventListener('mouseup', stopDrag);
    };
  }, [
    startTime,
    endTime,
    currentStart,
    currentEnd,
    totalDuration,
    onTimeRangeChange,
    timelineTrackRef,
    currentStartPercent,
    currentEndPercent,
    rangeIndicatorRef,
    startHandleRef,
    endHandleRef,
    disabled,
  ]);

  const handleStartDrag = useMemo(() => createDragHandler(true), [createDragHandler]);
  const handleEndDrag = useMemo(() => createDragHandler(false), [createDragHandler]);

  // Calculate display values
  const displayValues = useMemo(() => ({
    startPercent: currentStartPercent,
    endPercent: currentEndPercent,
    startTime: formatters.formatTime(startTime),
    endTime: formatters.formatTime(endTime),
    currentStart: formatters.formatTime(currentStart),
    currentEnd: formatters.formatTime(currentEnd),
  }), [formatters, startTime, endTime, currentStart, currentEnd, currentStartPercent, currentEndPercent]);

  return (
    <div className={cn("bg-background/80 backdrop-blur-sm border-t p-4", disabled && "opacity-75", className)}>
      <div className="max-w-full mx-auto">
        {/* Time labels */}
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{displayValues.startTime}</span>
          <span className="font-medium text-foreground">
            {displayValues.currentStart} - {displayValues.currentEnd}
          </span>
          <span>{displayValues.endTime}</span>
        </div>

        {/* Day markers (above timeline) */}
        <div className="relative h-6 mb-1">
          {dayMarkers.map((marker, index) => (
            <DayMarker key={`day-${index}`} marker={marker} />
          ))}
        </div>

        {/* Timeline track with enhanced markers */}
        <div
          ref={timelineTrackRef}
          className={cn("timeline-track relative h-3 bg-muted rounded-full overflow-visible mb-2", disabled && "pointer-events-none")}
        >
          {/* Time markers (6-hour intervals) */}
          {timeMarkers.map((marker, index) => (
            <TimeMarker key={`time-${index}`} marker={marker} />
          ))}

          {/* Active range indicator */}
          <div
            ref={rangeIndicatorRef}
            className="absolute top-0 h-full bg-primary rounded-full shadow-sm"
            style={{
              left: `${displayValues.startPercent}%`,
              width: `${displayValues.endPercent - displayValues.startPercent}%`,
              willChange: 'transform',
              transform: 'translateZ(0)', // Force hardware acceleration
              backfaceVisibility: 'hidden', // Prevent flickering
            }}
          />

          {/* Draggable window handles */}
          <div
            ref={startHandleRef}
            className="absolute top-0 w-3 h-full bg-primary-foreground rounded-full shadow-md opacity-90 cursor-ew-resize hover:bg-white hover:w-4 z-10"
            style={{
              left: `${displayValues.startPercent}%`,
              transform: 'translateX(-50%) translateZ(0)', // Hardware acceleration
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
            onMouseDown={handleStartDrag}
            title="Drag to adjust start time"
          />
          <div
            ref={endHandleRef}
            className="absolute top-0 w-3 h-full bg-primary-foreground rounded-full shadow-md opacity-90 cursor-ew-resize hover:bg-white hover:w-4 z-10"
            style={{
              left: `${displayValues.endPercent}%`,
              transform: 'translateX(-50%) translateZ(0)', // Hardware acceleration
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
            onMouseDown={handleEndDrag}
            title="Drag to adjust end time"
          />

          {/* Slider input */}
          <input
            ref={sliderInputRef}
            type="range"
            min="0"
            max="100"
            step="0.1"
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
            style={{
              background: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
              opacity: 0,
              willChange: 'transform',
              transform: 'translateZ(0)', // Hardware acceleration for smooth dragging
              backfaceVisibility: 'hidden',
            }}
            disabled={disabled}
          />
        </div>

        {/* Enhanced window info */}
        <div className="flex justify-between items-center mt-3 text-xs">
          <div className="text-muted-foreground">
            Total span: {constants.totalSpanDays}d {constants.totalSpanHours}h
          </div>
          <div className="px-2 py-1 bg-primary/10 rounded-md text-primary font-medium">
            Current: {constants.currentWindowMinutes}min window
          </div>
          <div className="text-muted-foreground">
            Showing {constants.currentWindowPercentage}% of timeline
          </div>
        </div>
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';
