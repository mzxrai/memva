import { useEffect } from "react";
import { useNavigate } from "react-router";

export function useBackNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+Left Arrow (Mac) or Ctrl+Left Arrow (Windows/Linux)
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      const isLeftArrow = event.key === "ArrowLeft";

      if (isMetaOrCtrl && isLeftArrow) {
        // Prevent default behavior (text cursor movement in textarea)
        event.preventDefault();
        
        // Navigate back
        navigate(-1);
      }
    };

    // Add event listener at document level to capture all key events
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate]);
}