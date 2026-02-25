"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { TemplateFolder } from "@/features/playground/libs/path-to-json";
import { transformToWebContainerFormat } from "../hooks/transformer";
import { analyzeProject } from "../hooks/project-analyzer";
import {
  CheckCircle,
  Loader2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  Smartphone,
  Tablet,
  Monitor,
  Laptop,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { WebContainer } from "@webcontainer/api";
import { cn } from "@/lib/utils";
import processManager from "../service/processManager";

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean;
  onTerminalWrite?: (data: string) => void;
}

type DeviceMode = "responsive" | "mobile-s" | "mobile-m" | "mobile-l" | "tablet" | "laptop" | "desktop";

interface DevicePreset {
  label: string;
  width: number | "100%";
  height: number | "100%";
  icon: React.ReactNode;
}

const DEVICE_PRESETS: Record<DeviceMode, DevicePreset> = {
  "responsive": { label: "Responsive", width: "100%", height: "100%", icon: <Monitor className="h-3.5 w-3.5" /> },
  "mobile-s": { label: "Mobile S", width: 320, height: 568, icon: <Smartphone className="h-3.5 w-3.5" /> },
  "mobile-m": { label: "Mobile M", width: 375, height: 667, icon: <Smartphone className="h-3.5 w-3.5" /> },
  "mobile-l": { label: "Mobile L", width: 425, height: 812, icon: <Smartphone className="h-3.5 w-3.5" /> },
  "tablet": { label: "Tablet", width: 768, height: 1024, icon: <Tablet className="h-3.5 w-3.5" /> },
  "laptop": { label: "Laptop", width: 1024, height: 768, icon: <Laptop className="h-3.5 w-3.5" /> },
  "desktop": { label: "Desktop", width: 1440, height: 900, icon: <Monitor className="h-3.5 w-3.5" /> },
};

const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({
  templateData,
  error,
  instance,
  isLoading,
  forceResetup = false,
  onTerminalWrite,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [urlInput, setUrlInput] = useState<string>("/");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  interface LoadingState {
    transforming: boolean;
    mounting: boolean;
    analyzing: boolean;
    installing: boolean;
    starting: boolean;
    ready: boolean;
  }

  const [, setLoadingState] = useState<LoadingState>({
    transforming: false,
    mounting: false,
    analyzing: false,
    installing: false,
    starting: false,
    ready: false,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("responsive");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const deviceMenuRef = useRef<HTMLDivElement>(null);
  const serverProcessIdRef = useRef<string | null>(null);

  // Custom resize state
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const writeToTerminal = useCallback((data: string) => {
    if (onTerminalWrite) {
      onTerminalWrite(data);
    }
  }, [onTerminalWrite]);

  // Close device menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
    };
    if (showDeviceMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDeviceMenu]);

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      setLoadingState({
        transforming: false,
        mounting: false,
        analyzing: false,
        installing: false,
        starting: false,
        ready: false,
      });
    }
  }, [forceResetup]);

  // Persistent server-ready discovery
  useEffect(() => {
    if (!instance) return;

    const unsubscribe = instance.on("server-ready", (port: number, url: string) => {
      writeToTerminal(`🌐 Server detected on port ${port} at ${url}\r\n`);
      setPreviewUrl(url);
      setUrlInput("/");
      setIsSetupComplete(true);
      setIsSetupInProgress(false);
      setNavigationHistory([url]);
      setHistoryIndex(0);
      setLoadingState((prev) => ({
        ...prev,
        starting: false,
        ready: true,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [instance, writeToTerminal]);

  // Helper: run a spawned process with timeout and output streaming
  const runProcessWithTimeout = useCallback(async (
    inst: WebContainer,
    cmd: string,
    args: string[],
    timeoutMs: number,
    termWrite: (data: string) => void,
    env?: Record<string, string>,
  ): Promise<{ exitCode: number; output: string }> => {
    let output = "";

    const spawnOptions = env ? { env } : undefined;
    const proc = await inst.spawn(cmd, args, spawnOptions);

    proc.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
          termWrite(data);
        },
      })
    ).catch(() => { /* ignore piping errors */ });

    // Race between process exit and timeout
    const exitCode = await Promise.race([
      proc.exit,
      new Promise<number>((_, reject) =>
        setTimeout(() => {
          try { proc.kill(); } catch { /* ignore */ }
          reject(new Error(`Process timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs)
      ),
    ]);

    return { exitCode, output };
  }, []);

  // Main Setup Logic
  useEffect(() => {
    async function setupContainer() {
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);

        try {
          const packageJsonExists = await instance.fs.readFile('package.json', 'utf8');
          if (packageJsonExists) {
            writeToTerminal("🔄 WebContainer already has files. Re-analyzing...\r\n");
          }
        } catch {
          // Normal flow — no existing files
        }

        // Step 1: Transform data
        setLoadingState((prev) => ({ ...prev, transforming: true }));
        setCurrentStep(1);
        writeToTerminal("🔄 Transforming template data...\r\n");

        // @ts-expect-error - type mismatch handled at runtime
        const files = transformToWebContainerFormat(templateData);

        setLoadingState((prev) => ({
          ...prev,
          transforming: false,
          mounting: true,
        }));
        setCurrentStep(2);

        // Step 2: Mount files
        writeToTerminal("📁 Mounting files to WebContainer...\r\n");
        await instance.mount(files);
        writeToTerminal("✅ Files mounted successfully\r\n");

        setLoadingState((prev) => ({
          ...prev,
          mounting: false,
          analyzing: true,
        }));
        setCurrentStep(3);

        // Step 3: Analyze project
        writeToTerminal("🔍 Analyzing project type...\r\n");
        const analysis = await analyzeProject(instance);

        if (analysis.detectedFiles.length > 0) {
          writeToTerminal(`📄 Found: ${analysis.detectedFiles.join(", ")}\r\n`);
        }
        writeToTerminal(`🏷️  Detected: ${analysis.type} project\r\n`);
        writeToTerminal(`💡 ${analysis.reason}\r\n`);
        if (analysis.packageManager) {
          writeToTerminal(`📦 Package manager: ${analysis.packageManager}\r\n`);
        }

        setLoadingState((prev) => ({
          ...prev,
          analyzing: false,
          installing: true,
        }));
        setCurrentStep(4);

        // Step 4: Install dependencies with CI env, retries, and timeout
        if (analysis.installCommand) {
          // CI env prevents interactive prompts (key bolt.diy pattern)
          const ciEnv: Record<string, string> = {
            CI: "true",
            FORCE_COLOR: "0",
            DEBIAN_FRONTEND: "noninteractive",
            npm_config_yes: "true",
            BROWSERSLIST_IGNORE_OLD_DATA: "true",  // Skip slow browserslist update prompt
            npm_config_update_notifier: "false",   // Skip "npm update available" check
          };

          // Remove lockfiles to avoid slow lockfile verification in WebContainer
          if (analysis.shouldRemoveLockfile) {
            const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'];
            for (const lockfile of lockfiles) {
              try {
                await instance.fs.rm(lockfile);
                writeToTerminal(`🗑️  Removed ${lockfile} for faster install\r\n`);
              } catch {
                // Lockfile doesn't exist — that's fine
              }
            }
          }

          // Run pre-install commands (e.g. browserslist update)
          for (const [preCmd, preArgs] of analysis.preInstallCommands) {
            writeToTerminal(`⚡ Pre-install: ${preCmd} ${preArgs.join(" ")}\r\n`);
            try {
              await runProcessWithTimeout(instance, preCmd, preArgs, 30_000, writeToTerminal, ciEnv);
            } catch (e) {
              writeToTerminal(`⚠️  Pre-install step failed (non-fatal): ${e instanceof Error ? e.message : String(e)}\r\n`);
              // Pre-install failures are not fatal
            }
          }

          // Install with retry (up to 2 attempts)
          const MAX_RETRIES = 2;
          let installSuccess = false;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            writeToTerminal(`\r\n📦 Installing dependencies (attempt ${attempt}/${MAX_RETRIES})...\r\n`);
            writeToTerminal(`   Running: ${analysis.installCommand[0]} ${analysis.installCommand[1].join(" ")}\r\n`);

            try {
              const { exitCode } = await runProcessWithTimeout(
                instance,
                analysis.installCommand[0],
                analysis.installCommand[1],
                120_000, // 2 minute timeout for install
                writeToTerminal,
                ciEnv,
              );

              if (exitCode === 0) {
                writeToTerminal("✅ Dependencies installed successfully\r\n");
                installSuccess = true;
                break;
              } else {
                writeToTerminal(`\r\n⚠️  Install exited with code ${exitCode}\r\n`);
                if (attempt < MAX_RETRIES) {
                  writeToTerminal(`🔄 Retrying in 1 second...\r\n`);
                  await new Promise(r => setTimeout(r, 1000));
                }
              }
            } catch (timeoutErr) {
              writeToTerminal(`\r\n⏱️  ${timeoutErr instanceof Error ? timeoutErr.message : "Install timed out"}\r\n`);
              if (attempt < MAX_RETRIES) {
                writeToTerminal(`🔄 Retrying in 1 second...\r\n`);
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }

          if (!installSuccess) {
            writeToTerminal("\r\n⚠️  Dependencies may not have installed correctly.\r\n");
            writeToTerminal("   Attempting to start the server anyway...\r\n");
            // Don't throw — try to start the server anyway
            // Some projects can partially work even with install errors
          }
        } else {
          writeToTerminal("⏩ Skipping install — no package manager detected\r\n");
        }

        setLoadingState((prev) => ({
          ...prev,
          installing: false,
          starting: true,
        }));
        setCurrentStep(5);

        // Step 5: Start the server
        if (analysis.startCommand) {
          writeToTerminal(`🚀 Starting: ${analysis.startCommand[0]} ${analysis.startCommand[1].join(" ")}\r\n`);

          const startProcess = await instance.spawn(analysis.startCommand[0], analysis.startCommand[1]);

          // Register with the shared process manager so it can be killed from terminal tabs
          const procId = processManager.register(
            startProcess,
            `${analysis.startCommand[0]} ${analysis.startCommand[1].join(" ")}`,
          );
          serverProcessIdRef.current = procId;

          startProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                writeToTerminal(data);

                // Try to detect the port from output
                const portMatch = data.match(/(?:port|localhost:|127\.0\.0\.1:|:::)(\d{4,5})/i);
                if (portMatch) {
                  const port = parseInt(portMatch[1], 10);
                  const info = processManager.getAll().find(p => p.id === procId);
                  if (info && !info.port) {
                    info.port = port;
                  }
                }
              },
            })
          ).catch(() => { /* ignore */ });

          // When the server process exits naturally, unregister it
          startProcess.exit.then(() => {
            processManager.unregister(procId);
            serverProcessIdRef.current = null;
          }).catch(() => { /* ignore */ });
        } else {
          writeToTerminal("⏩ Skipping dev server — no start command detected\r\n");
          setLoadingState((prev) => ({
            ...prev,
            starting: false,
            ready: true,
          }));
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
        }
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
        setLoadingState({
          transforming: false,
          mounting: false,
          analyzing: false,
          installing: false,
          starting: false,
          ready: false,
        });
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress, writeToTerminal]);

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (iframeRef.current) {
        iframeRef.current.src = navigationHistory[newIndex];
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (iframeRef.current) {
        iframeRef.current.src = navigationHistory[newIndex];
      }
    }
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  };

  const handleFullscreenToggle = () => {
    if (!previewContainerRef.current) return;
    if (!isFullscreen) {
      previewContainerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (previewUrl && iframeRef.current) {
      const baseUrl = new URL(previewUrl);
      const newUrl = urlInput.startsWith("http") ? urlInput : `${baseUrl.origin}${urlInput.startsWith("/") ? urlInput : "/" + urlInput}`;
      iframeRef.current.src = newUrl;
      setNavigationHistory(prev => [...prev.slice(0, historyIndex + 1), newUrl]);
      setHistoryIndex(prev => prev + 1);
    }
  };

  const handleDeviceSelect = (mode: DeviceMode) => {
    setDeviceMode(mode);
    setCustomWidth(null);
    setShowDeviceMenu(false);
  };

  // Resize handle logic
  const handleResizeStart = useCallback((e: React.MouseEvent, side: "left" | "right") => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const container = previewContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const currentIframeWidth = customWidth || (deviceMode === "responsive" ? containerRect.width : (DEVICE_PRESETS[deviceMode].width as number));

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = side === "right"
        ? Math.max(280, currentIframeWidth + deltaX * 2) // *2 because we center
        : Math.max(280, currentIframeWidth - deltaX * 2);
      setCustomWidth(Math.min(newWidth, containerRect.width));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [customWidth, deviceMode]);

  const getDeviceWidth = (): string => {
    if (customWidth) return `${customWidth}px`;
    const preset = DEVICE_PRESETS[deviceMode];
    return typeof preset.width === "number" ? `${preset.width}px` : "100%";
  };

  const getDeviceHeight = (): string => {
    const preset = DEVICE_PRESETS[deviceMode];
    return typeof preset.height === "number" ? `${preset.height}px` : "100%";
  };

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-4 w-4 animate-spin text-[#89B4FA]" />;
    } else {
      return <div className="h-4 w-4 rounded-full border-2 border-[#45475A]" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span className={cn(
        "text-xs font-medium",
        isComplete && "text-green-400",
        isActive && "text-[#89B4FA]",
        !isComplete && !isActive && "text-[#6C7086]"
      )}>
        {label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E2E]">
        <div className="text-center space-y-4 max-w-md p-6">
          <Loader2 className="h-10 w-10 animate-spin text-[#89B4FA] mx-auto" />
          <h3 className="text-sm font-medium text-[#CDD6F4]">Initializing WebContainer</h3>
          <p className="text-xs text-[#6C7086]">
            Setting up the environment...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E2E]">
        <div className="bg-[#45475A]/30 text-red-400 p-6 rounded-lg max-w-md border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold text-sm">Error</h3>
          </div>
          <p className="text-xs">{error || setupError}</p>
          <button
            className="mt-3 text-xs flex items-center gap-1.5 text-[#89B4FA] hover:text-[#B4D0FB] transition-colors"
            onClick={() => {
              setSetupError(null);
              setIsSetupComplete(false);
              setIsSetupInProgress(false);
              setCurrentStep(0);
            }}
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={previewContainerRef} className="h-full w-full flex flex-col bg-[#1E1E2E]">
      {/* URL Bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#313244] bg-[#181825] shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors disabled:opacity-30"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            title="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors disabled:opacity-30"
            onClick={handleForward}
            disabled={historyIndex >= navigationHistory.length - 1}
            title="Forward"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={handleReload}
            title="Reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center bg-[#11111B] border border-[#313244] rounded-md px-2 py-0.5 focus-within:border-[#89B4FA] transition-colors">
          <Globe className="h-3 w-3 text-[#6C7086] mr-1.5 shrink-0" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[#CDD6F4] outline-none placeholder-[#6C7086]"
            placeholder="/"
          />
        </form>

        {/* Device Mode & Controls */}
        <div className="flex items-center gap-0.5 relative">
          {/* Device Mode Dropdown */}
          <div className="relative" ref={deviceMenuRef}>
            <button
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                showDeviceMenu
                  ? "bg-[#313244] text-[#CDD6F4]"
                  : "text-[#6C7086] hover:bg-[#313244] hover:text-[#CDD6F4]"
              )}
              onClick={() => setShowDeviceMenu(!showDeviceMenu)}
              title="Device Mode"
            >
              {DEVICE_PRESETS[deviceMode].icon}
              <span className="hidden sm:inline">{DEVICE_PRESETS[deviceMode].label}</span>
            </button>

            {showDeviceMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[#313244] bg-[#1E1E2E] p-1 shadow-xl z-50">
                {(Object.entries(DEVICE_PRESETS) as [DeviceMode, DevicePreset][]).map(([key, preset]) => (
                  <button
                    key={key}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
                      deviceMode === key
                        ? "bg-[#313244] text-[#CDD6F4]"
                        : "text-[#BAC2DE] hover:bg-[#313244] hover:text-[#CDD6F4]"
                    )}
                    onClick={() => handleDeviceSelect(key)}
                  >
                    {preset.icon}
                    <span>{preset.label}</span>
                    {typeof preset.width === "number" && (
                      <span className="ml-auto text-[#6C7086]">{preset.width}×{typeof preset.height === "number" ? preset.height : "∞"}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#313244] mx-0.5" />

          {/* Fullscreen */}
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={handleFullscreenToggle}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Open External */}
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Device dimensions display */}
      {deviceMode !== "responsive" && (
        <div className="flex items-center justify-center py-0.5 bg-[#181825] border-b border-[#313244]">
          <span className="text-[10px] text-[#6C7086]">
            {customWidth ? `${Math.round(customWidth)}` : DEVICE_PRESETS[deviceMode].width} × {typeof DEVICE_PRESETS[deviceMode].height === "number" ? DEVICE_PRESETS[deviceMode].height : "∞"}
          </span>
        </div>
      )}

      {/* Preview Content */}
      <div className="flex-1 flex items-start justify-center overflow-hidden bg-[#11111B] relative">
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <div className="w-full max-w-sm p-5 rounded-lg bg-[#1E1E2E] border border-[#313244] mx-auto">
              <Progress
                value={(currentStep / totalSteps) * 100}
                className="h-1.5 mb-5"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  {getStepIcon(1)}
                  {getStepText(1, "Transforming template data")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(2)}
                  {getStepText(2, "Mounting files")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(3)}
                  {getStepText(3, "Analyzing project")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(4)}
                  {getStepText(4, "Installing dependencies")}
                </div>
                <div className="flex items-center gap-2.5">
                  {getStepIcon(5)}
                  {getStepText(5, "Starting development server")}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative transition-all duration-200 mx-auto",
              deviceMode !== "responsive" && "flex items-center justify-center py-4"
            )}
            style={{
              width: deviceMode === "responsive" ? "100%" : undefined,
              height: "100%",
            }}
          >
            {/* Left resize handle */}
            {deviceMode !== "responsive" && (
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group flex items-center justify-center",
                  isResizing && "bg-[#89B4FA]/10"
                )}
                onMouseDown={(e) => handleResizeStart(e, "left")}
                style={{
                  left: `calc(50% - ${(customWidth || (DEVICE_PRESETS[deviceMode].width as number)) / 2}px - 8px)`,
                }}
              >
                <div className="w-1 h-8 bg-[#45475A] rounded-full group-hover:bg-[#89B4FA] transition-colors" />
              </div>
            )}

            <div
              className={cn(
                "h-full mx-auto transition-all duration-200",
                deviceMode !== "responsive" && "border border-[#313244] rounded-md overflow-hidden shadow-2xl"
              )}
              style={{
                width: getDeviceWidth(),
                maxWidth: "100%",
                height: deviceMode === "responsive" ? "100%" : getDeviceHeight(),
                maxHeight: "100%",
              }}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-none bg-white"
                title="WebContainer Preview"
              />
            </div>

            {/* Right resize handle */}
            {deviceMode !== "responsive" && (
              <div
                className={cn(
                  "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group flex items-center justify-center",
                  isResizing && "bg-[#89B4FA]/10"
                )}
                onMouseDown={(e) => handleResizeStart(e, "right")}
                style={{
                  right: `calc(50% - ${(customWidth || (DEVICE_PRESETS[deviceMode].width as number)) / 2}px - 8px)`,
                }}
              >
                <div className="w-1 h-8 bg-[#45475A] rounded-full group-hover:bg-[#89B4FA] transition-colors" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebContainerPreview;