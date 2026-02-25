import { useState, useRef, useCallback } from "react";

interface AISuggestionsState {
  suggestion: string | null;
  isLoading: boolean;
  position: { line: number; column: number } | null;
  decoration: string[];
  isEnabled: boolean;
}

interface UseAISuggestionsReturn extends AISuggestionsState {
  toggleEnabled: () => void;
  fetchSuggestion: (type: string, editor: any) => Promise<void>;
  acceptSuggestion: (editor: any, monaco: any) => void;
  rejectSuggestion: (editor: any) => void;
  clearSuggestion: (editor: any) => void;
}

export const useAISuggestions = (): UseAISuggestionsReturn => {
  const [state, setState] = useState<AISuggestionsState>({
    suggestion: null,
    isLoading: false,
    position: null,
    decoration: [],
    isEnabled: true,
  });

  // Use a ref to track the current state for callbacks to avoid stale closures
  // and need for state dependencies in useCallback.
  const stateRef = useRef(state);
  stateRef.current = state;

  const toggleEnabled = useCallback(() => {
    console.log("Toggling AI suggestions");
    setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

  const fetchSuggestion = useCallback(async (type: string, editor: any) => {
    const currentState = stateRef.current;

    if (!currentState.isEnabled) {
      console.warn("AI suggestions are disabled.");
      return;
    }

    if (!editor) {
      console.warn("Editor instance is not available.");
      return;
    }

    const model = editor.getModel();
    const cursorPosition = editor.getPosition();

    if (!model || !cursorPosition) {
      console.warn("Editor model or cursor position is not available.");
      return;
    }

    console.log("Fetching AI suggestion...");

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const payload = {
        fileContent: model.getValue(),
        cursorLine: cursorPosition.lineNumber - 1,
        cursorColumn: cursorPosition.column - 1,
        suggestionType: type,
      };

      const response = await fetch("/api/code-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();

      if (data.suggestion) {
        const suggestionText = data.suggestion.trim();
        setState((prev) => ({
          ...prev,
          suggestion: suggestionText,
          position: {
            line: cursorPosition.lineNumber,
            column: cursorPosition.column,
          },
          isLoading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Error fetching code suggestion:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const acceptSuggestion = useCallback(
    (editor: any, monaco: any) => {
      const currentState = stateRef.current;

      if (!currentState.suggestion || !currentState.position || !editor || !monaco) {
        return;
      }

      const { line, column } = currentState.position;
      const sanitizedSuggestion = currentState.suggestion.replace(/^\d+:\s*/gm, "");

      // Execute side effect OUTSIDE of setState
      editor.executeEdits("", [
        {
          range: new monaco.Range(line, column, line, column),
          text: sanitizedSuggestion,
          forceMoveMarkers: true,
        },
      ]);

      // Clear decorations if any
      if (currentState.decoration.length > 0) {
        editor.deltaDecorations(currentState.decoration, []);
      }

      // Update state to clear the suggestion
      setState((prev) => ({
        ...prev,
        suggestion: null,
        position: null,
        decoration: [],
      }));
    },
    []
  );

  const rejectSuggestion = useCallback((editor: any) => {
    const currentState = stateRef.current;

    if (editor && currentState.decoration.length > 0) {
      editor.deltaDecorations(currentState.decoration, []);
    }

    setState((prev) => ({
      ...prev,
      suggestion: null,
      position: null,
      decoration: [],
    }));
  }, []);

  const clearSuggestion = useCallback((editor: any) => {
    const currentState = stateRef.current;

    if (editor && currentState.decoration.length > 0) {
      editor.deltaDecorations(currentState.decoration, []);
    }

    setState((prev) => ({
      ...prev,
      suggestion: null,
      position: null,
      decoration: [],
    }));
  }, []);

  return {
    ...state,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion,
  };
};