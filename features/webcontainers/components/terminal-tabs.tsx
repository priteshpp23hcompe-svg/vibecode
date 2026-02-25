"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Plus,
    X,
    RotateCcw,
    ChevronDown,
    Terminal as TerminalIcon,
    Zap,
    Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TerminalComponent from "./terminal";
import type { TerminalRef } from "./terminal";
import type { WebContainer } from "@webcontainer/api";
import processManager from "../service/processManager";

const MAX_TERMINALS = 3;

interface TerminalTabsProps {
    webContainerInstance?: WebContainer | null;
    onClose?: () => void;
    className?: string;
}

export function TerminalTabs({
    webContainerInstance,
    onClose,
    className,
}: TerminalTabsProps) {
    const [activeTerminal, setActiveTerminal] = useState(0);
    // Track terminal IDs in a Set so closing actually removes them
    const [terminalIds, setTerminalIds] = useState<number[]>([]);
    const nextIdRef = useRef(1);
    const terminalRefs = useRef<Map<number, TerminalRef | null>>(new Map());
    // Track which terminals have running processes
    const [runningProcesses, setRunningProcesses] = useState<Set<number>>(new Set());
    // Track server processes from the shared process manager
    const [managedProcessCount, setManagedProcessCount] = useState(processManager.count);

    // Subscribe to process manager changes
    useEffect(() => {
        const unsubscribe = processManager.subscribe((processes) => {
            setManagedProcessCount(processes.size);
        });
        return unsubscribe;
    }, []);

    const addTerminal = useCallback(() => {
        if (terminalIds.length < MAX_TERMINALS) {
            const newId = nextIdRef.current++;
            setTerminalIds((prev) => [...prev, newId]);
            setActiveTerminal(newId);
        }
    }, [terminalIds.length]);

    const closeTerminal = useCallback(
        (id: number) => {
            if (id === 0) return; // Can't close bolt terminal

            // Kill any running process before closing
            const ref = terminalRefs.current.get(id);
            if (ref?.isProcessRunning()) {
                ref.killProcess();
            }

            // Cleanup ref
            terminalRefs.current.delete(id);

            // Remove from running processes set
            setRunningProcesses((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });

            // Remove from rendered list
            setTerminalIds((prev) => prev.filter((tid) => tid !== id));

            // If closing the active terminal, switch to bolt
            if (activeTerminal === id) {
                setActiveTerminal(0);
            }
        },
        [activeTerminal]
    );

    const resetTerminal = useCallback(() => {
        const ref = terminalRefs.current.get(activeTerminal);
        if (ref) {
            ref.clearTerminal();
        }
    }, [activeTerminal]);

    const killActiveProcess = useCallback(() => {
        // First, kill all managed processes (server started by preview)
        if (processManager.count > 0) {
            processManager.killAll();
        }

        // Also send Ctrl+C to the active terminal's shell
        // (in case the process was started manually in the shell)
        const ref = terminalRefs.current.get(activeTerminal);
        if (ref) {
            ref.killProcess();
        }
    }, [activeTerminal]);

    const handleProcessStateChange = useCallback((terminalId: number, isRunning: boolean) => {
        setRunningProcesses((prev) => {
            const next = new Set(prev);
            if (isRunning) {
                next.add(terminalId);
            } else {
                next.delete(terminalId);
            }
            return next;
        });
    }, []);

    const isActiveProcessRunning = runningProcesses.has(activeTerminal) || managedProcessCount > 0;
    const totalRunning = runningProcesses.size + managedProcessCount;

    return (
        <div className={cn("h-full flex flex-col bg-[#11111B]", className)}>
            {/* Tab Bar */}
            <div className="flex items-center bg-[#181825] border-y border-[#313244] gap-1 min-h-[34px] px-2 shrink-0">
                {/* Bolt Terminal Tab (always first, non-closable) */}
                <button
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors relative",
                        activeTerminal === 0
                            ? "bg-[#313244] text-[#CDD6F4]"
                            : "text-[#6C7086] hover:text-[#BAC2DE] hover:bg-[#1E1E2E]"
                    )}
                    onClick={() => setActiveTerminal(0)}
                >
                    <Zap className="h-3.5 w-3.5" />
                    VibeCode Terminal
                    {/* Running process indicator */}
                    {runningProcesses.has(0) && (
                        <span className="relative flex h-2 w-2 ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                    )}
                </button>

                {/* Additional Terminal Tabs */}
                {terminalIds.map((id) => {
                    const isActive = activeTerminal === id;
                    const hasRunning = runningProcesses.has(id);

                    return (
                        <button
                            key={id}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors group relative",
                                isActive
                                    ? "bg-[#313244] text-[#CDD6F4]"
                                    : "text-[#6C7086] hover:text-[#BAC2DE] hover:bg-[#1E1E2E]"
                            )}
                            onClick={() => setActiveTerminal(id)}
                        >
                            <TerminalIcon className="h-3.5 w-3.5" />
                            Terminal {id}
                            {/* Running process indicator */}
                            {hasRunning && (
                                <span className="relative flex h-2 w-2 ml-0.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                            )}
                            <span
                                className="ml-1 p-0.5 rounded hover:bg-[#45475A] opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTerminal(id);
                                }}
                            >
                                <X className="h-2.5 w-2.5" />
                            </span>
                        </button>
                    );
                })}

                {/* Add Terminal Button */}
                {terminalIds.length < MAX_TERMINALS && (
                    <button
                        className="p-1.5 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
                        onClick={addTerminal}
                        title="New Terminal"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                )}

                {/* Separator */}
                <div className="w-px h-4 bg-[#313244] mx-0.5" />

                {/* Kill Process Button */}
                <button
                    className={cn(
                        "p-1.5 rounded transition-colors flex items-center gap-1",
                        isActiveProcessRunning
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300"
                            : "text-[#45475A] cursor-not-allowed"
                    )}
                    onClick={killActiveProcess}
                    disabled={!isActiveProcessRunning}
                    title={isActiveProcessRunning ? "Stop Process (Ctrl+C)" : "No running process"}
                >
                    <Square className="h-3 w-3" fill={isActiveProcessRunning ? "currentColor" : "none"} />
                    {isActiveProcessRunning && (
                        <span className="text-[10px] font-medium">Stop</span>
                    )}
                </button>

                {/* Reset Terminal */}
                <button
                    className="p-1.5 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
                    onClick={resetTerminal}
                    title="Clear Terminal"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Running processes count  */}
                {totalRunning > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 mr-1">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                        <span className="text-[10px] text-green-400 font-medium">
                            {totalRunning} running
                        </span>
                    </div>
                )}

                {/* Close Panel */}
                {onClose && (
                    <button
                        className="p-1.5 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
                        onClick={onClose}
                        title="Close Terminal"
                    >
                        <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Terminal Content */}
            <div className="flex-1 min-h-0 relative">
                {/* Bolt Terminal (index 0, always rendered) */}
                <div className={cn("absolute inset-0", activeTerminal !== 0 && "invisible")}>
                    <TerminalComponent
                        ref={(el) => { terminalRefs.current.set(0, el); }}
                        webContainerInstance={webContainerInstance}
                        theme="dark"
                        id="bolt"
                        className="h-full"
                        onProcessStateChange={(isRunning) => handleProcessStateChange(0, isRunning)}
                    />
                </div>

                {/* Additional Terminals — only rendered while in the list */}
                {terminalIds.map((id) => (
                    <div
                        key={id}
                        className={cn("absolute inset-0", activeTerminal !== id && "invisible")}
                    >
                        <TerminalComponent
                            ref={(el) => { terminalRefs.current.set(id, el); }}
                            webContainerInstance={webContainerInstance}
                            theme="dark"
                            id={`terminal-${id}`}
                            className="h-full"
                            onProcessStateChange={(isRunning) => handleProcessStateChange(id, isRunning)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TerminalTabs;
