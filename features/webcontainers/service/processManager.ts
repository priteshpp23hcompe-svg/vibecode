import { WebContainerProcess } from "@webcontainer/api";

export type ProcessInfo = {
    id: string;
    process: WebContainerProcess;
    command: string;
    port?: number;
    startedAt: number;
};

type ProcessListener = (processes: Map<string, ProcessInfo>) => void;

/**
 * Shared process manager that tracks all spawned processes across
 * the terminal, preview, and other components. This enables any
 * component to kill a running server regardless of where it was started.
 */
class ProcessManager {
    private static instance: ProcessManager | null = null;
    private processes = new Map<string, ProcessInfo>();
    private listeners = new Set<ProcessListener>();
    private nextId = 1;

    private constructor() { }

    public static getInstance(): ProcessManager {
        if (!ProcessManager.instance) {
            ProcessManager.instance = new ProcessManager();
        }
        return ProcessManager.instance;
    }

    /** Register a spawned process for tracking */
    public register(process: WebContainerProcess, command: string, port?: number): string {
        const id = `proc-${this.nextId++}`;
        this.processes.set(id, {
            id,
            process,
            command,
            port,
            startedAt: Date.now(),
        });
        this.notify();
        return id;
    }

    /** Kill a specific process by its ID */
    public kill(id: string): boolean {
        const info = this.processes.get(id);
        if (!info) return false;

        try {
            info.process.kill();
        } catch {
            // Process may already be dead
        }
        this.processes.delete(id);
        this.notify();
        return true;
    }

    /** Kill all processes running on a specific port */
    public killByPort(port: number): boolean {
        let killed = false;
        for (const [id, info] of this.processes) {
            if (info.port === port) {
                try {
                    info.process.kill();
                } catch {
                    // ignore
                }
                this.processes.delete(id);
                killed = true;
            }
        }
        if (killed) this.notify();
        return killed;
    }

    /** Kill ALL tracked processes */
    public killAll(): void {
        for (const [, info] of this.processes) {
            try {
                info.process.kill();
            } catch {
                // ignore
            }
        }
        this.processes.clear();
        this.notify();
    }

    /** Unregister a process (e.g. when it exits naturally) without killing it */
    public unregister(id: string): void {
        this.processes.delete(id);
        this.notify();
    }

    /** Get all tracked processes */
    public getAll(): ProcessInfo[] {
        return Array.from(this.processes.values());
    }

    /** Get count of running processes */
    public get count(): number {
        return this.processes.size;
    }

    /** Subscribe to process changes */
    public subscribe(listener: ProcessListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(new Map(this.processes));
        }
    }
}

export const processManager = ProcessManager.getInstance();
export default processManager;
