import { useEffect } from "react";

// Distance from the top/bottom of the window where scrolling starts while dragging.
const EDGE_ZONE_PX = 160;
// Scroll speed (pixels per frame) when the pointer is at the very edge.
const MAX_STEP_PX = 24;

export function useDragAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let pointerY: number | null = null;
    let frame = 0;

    const trackPointer = (event: DragEvent) => {
      pointerY = event.clientY;
    };

    // Speed grows the closer the pointer gets to the edge.
    const scrollStep = () => {
      if (pointerY !== null) {
        const fromBottom = window.innerHeight - pointerY;
        if (pointerY < EDGE_ZONE_PX) {
          window.scrollBy(0, -MAX_STEP_PX * (1 - Math.max(pointerY, 0) / EDGE_ZONE_PX));
        } else if (fromBottom < EDGE_ZONE_PX) {
          window.scrollBy(0, MAX_STEP_PX * (1 - Math.max(fromBottom, 0) / EDGE_ZONE_PX));
        }
      }
      frame = requestAnimationFrame(scrollStep);
    };

    window.addEventListener("dragover", trackPointer);
    frame = requestAnimationFrame(scrollStep);

    return () => {
      window.removeEventListener("dragover", trackPointer);
      cancelAnimationFrame(frame);
    };
  }, [active]);
}
