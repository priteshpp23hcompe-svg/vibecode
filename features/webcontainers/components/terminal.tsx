"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";
import type { SearchAddon } from "xterm-addon-search";
import { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { cn } from "@/lib/utils";

interface TerminalProps {
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: WebContainer | null;
  id?: string;
  onTerminalReady?: (terminal: Terminal) => void;
  onProcessStateChange?: (isRunning: boolean) => void;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
  getTerminal: () => Terminal | null;
  reloadStyles: () => void;
  killProcess: () => void;
  isProcessRunning: () => boolean;
}

const terminalThemes = {
  dark: {
    background: "#11111B",
    foreground: "#CDD6F4",
    cursor: "#F5E0DC",
    cursorAccent: "#11111B",
    selection: "#45475A",
    black: "#45475A",
    red: "#F38BA8",
    green: "#A6E3A1",
    yellow: "#F9E2AF",
    blue: "#89B4FA",
    magenta: "#F5C2E7",
    cyan: "#94E2D5",
    white: "#BAC2DE",
    brightBlack: "#585B70",
    brightRed: "#F38BA8",
    brightGreen: "#A6E3A1",
    brightYellow: "#F9E2AF",
    brightBlue: "#89B4FA",
    brightMagenta: "#F5C2E7",
    brightCyan: "#94E2D5",
    brightWhite: "#A6ADC8",
  },
  light: {
    background: "#FFFFFF",
    foreground: "#09090B",
    cursor: "#09090B",
    cursorAccent: "#FFFFFF",
    selection: "#E4E4E7",
    black: "#000000",
    red: "#DC2626",
    green: "#16A34A",
    yellow: "#CA8A04",
    blue: "#2563EB",
    magenta: "#9333EA",
    cyan: "#0891B2",
    white: "#FAFAFA",
    brightBlack: "#71717A",
    brightRed: "#EF4444",
    brightGreen: "#22C55E",
    brightYellow: "#EAB308",
    brightBlue: "#3B82F6",
    brightMagenta: "#A855F7",
    brightCyan: "#06B6D4",
    brightWhite: "#18181B",
  },
};

// Patterns that indicate a long-running server process has started
const SERVER_RUNNING_PATTERNS = [
  /listening on/i,
  /ready on/i,
  /started server/i,
  /server running/i,
  /server started/i,
  /local:\s+http/i,
  /ready in \d+/i,
  /compiled successfully/i,
  /webpack compiled/i,
  /waiting for changes/i,
  /watching for file changes/i,
  /press ctrl[+-]c/i,
];

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({
  className,
  theme = "dark",
  webContainerInstance,
  id = "default",
  onTerminalReady,
  onProcessStateChange,
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTermReady, setIsTermReady] = useState(false);

  const shellProcess = useRef<WebContainerProcess | null>(null);
  const processRunning = useRef<boolean>(false);

  const setProcessRunning = useCallback((running: boolean) => {
    if (processRunning.current !== running) {
      processRunning.current = running;
      onProcessStateChange?.(running);
    }
  }, [onProcessStateChange]);

  const clearTerminal = useCallback(() => {
    if (term.current) {
      term.current.clear();
      if (!shellProcess.current) {
        term.current.writeln("🚀 WebContainer Terminal (jsh)");
      }
    }
  }, []);

  const killProcess = useCallback(() => {
    if (shellProcess.current) {
      // Send Ctrl+C (ETX character \x03) to the shell's stdin
      const writer = shellProcess.current.input.getWriter();
      writer.write("\x03");
      writer.releaseLock();
      setProcessRunning(false);
    }
  }, [setProcessRunning]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
      }
    },
    clearTerminal: () => {
      clearTerminal();
    },
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
    getTerminal: () => {
      return term.current;
    },
    reloadStyles: () => {
      if (term.current) {
        term.current.options.theme = terminalThemes[theme];
      }
    },
    killProcess: () => {
      killProcess();
    },
    isProcessRunning: () => {
      return processRunning.current;
    },
  }));

  // Dynamically import xterm and initialize the terminal (client-only)
  useEffect(() => {
    if (!terminalRef.current || term.current) return;

    let cancelled = false;

    async function init() {
      // Load xterm CSS via link tag (avoids SSR issues)
      if (!document.querySelector('link[data-xterm-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/node_modules/xterm/css/xterm.css';
        link.setAttribute('data-xterm-css', 'true');
        // Fallback: try to import CSS via require for bundler
        try {
          require("xterm/css/xterm.css");
        } catch {
          // If require fails, the link tag above might work or styles are already bundled
        }
      }

      // Dynamic imports — these modules use `self` and can only run in the browser
      const [
        { Terminal },
        { FitAddon: FitAddonCtor },
        { WebLinksAddon },
        { SearchAddon: SearchAddonCtor },
      ] = await Promise.all([
        import("xterm"),
        import("xterm-addon-fit"),
        import("xterm-addon-web-links"),
        import("xterm-addon-search"),
      ]);

      if (cancelled || !terminalRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        letterSpacing: 0,
        theme: terminalThemes[theme],
        allowTransparency: false,
        convertEol: true,
        scrollback: 5000,
        tabStopWidth: 4,
        rightClickSelectsWord: true,
      });

      const fitAddonInstance = new FitAddonCtor();
      const webLinksAddonInst = new WebLinksAddon();
      const searchAddonInstance = new SearchAddonCtor();

      terminal.loadAddon(fitAddonInstance);
      terminal.loadAddon(webLinksAddonInst);
      terminal.loadAddon(searchAddonInstance);

      terminal.open(terminalRef.current);

      fitAddon.current = fitAddonInstance;
      searchAddon.current = searchAddonInstance;
      term.current = terminal;

      // Handle terminal input — pipe to shell stdin
      terminal.onData((data) => {
        if (shellProcess.current) {
          const writer = shellProcess.current.input.getWriter();
          writer.write(data);
          writer.releaseLock();

          // If user sends Ctrl+C, mark process as stopped
          if (data === "\x03") {
            processRunning.current = false;
            onProcessStateChange?.(false);
          }
        }
      });

      // Initial fit
      setTimeout(() => {
        fitAddonInstance.fit();
      }, 100);

      // Welcome message with shortcut hints
      terminal.writeln("🚀 WebContainer Terminal (jsh)");
      terminal.writeln("\x1b[90m   Ctrl+C to stop running processes\x1b[0m");
      terminal.writeln("Connecting to shell...");

      onTerminalReady?.(terminal);
      setIsTermReady(true);
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Resize observer
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && term.current) {
        setTimeout(() => {
          fitAddon.current?.fit();
          if (shellProcess.current) {
            shellProcess.current.resize({
              cols: term.current!.cols,
              rows: term.current!.rows,
            });
          }
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (shellProcess.current) {
        shellProcess.current.kill();
        shellProcess.current = null;
      }
      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
    };
  }, []);

  // Connect to WebContainer shell
  useEffect(() => {
    if (!webContainerInstance || !term.current || !isTermReady || isConnected || shellProcess.current) return;

    async function connect() {
      if (!webContainerInstance || !term.current) return;

      try {
        const process = await webContainerInstance.spawn('jsh', {
          terminal: {
            cols: term.current!.cols,
            rows: term.current!.rows,
          },
        });

        shellProcess.current = process;
        setIsConnected(true);

        process.output.pipeTo(new WritableStream({
          write(data) {
            if (term.current) {
              term.current.write(data);
            }

            // Check for server running patterns
            for (const pattern of SERVER_RUNNING_PATTERNS) {
              if (pattern.test(data)) {
                processRunning.current = true;
                onProcessStateChange?.(true);
                break;
              }
            }
          },
        }));

        if (term.current) {
          term.current.writeln("✅ Shell connected");
        }
      } catch (error) {
        setIsConnected(false);
        if (term.current) {
          term.current.writeln("❌ Failed to connect to WebContainer");
        }
        console.error("WebContainer connection error:", error);
      }
    }

    connect();
  }, [webContainerInstance, isTermReady, isConnected, onProcessStateChange]);

  return (
    <div className={cn("h-full relative", className)}>
      <div
        ref={terminalRef}
        className="absolute inset-0"
        style={{
          background: terminalThemes[theme].background,
          padding: "4px 0 0 8px",
        }}
      />
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;