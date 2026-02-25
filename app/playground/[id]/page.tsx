"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  FileText,
  FolderOpen,
  AlertCircle,
  Save,
  X,
  Download,
  Terminal as TerminalIcon,
  Zap,
  ChevronRight,
  Code,
  MonitorPlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import WebContainerPreview from "@/features/webcontainers/components/webcontainer-preveiw";
const TerminalTabs = dynamic(
  () => import("@/features/webcontainers/components/terminal-tabs").then(m => ({ default: m.TerminalTabs })),
  { ssr: false, loading: () => <div className="h-full bg-[#11111B]" /> }
);
import type { TerminalRef } from "@/features/webcontainers/components/terminal";
import LoadingStep from "@/components/ui/loader";
import { PlaygroundEditor } from "@/features/playground/components/playground-editor";
import ToggleAI from "@/features/playground/components/toggle-ai";
import { TemplateFileTree } from "@/features/playground/components/playground-explorer";
import { useFileExplorer } from "@/features/playground/hooks/useFileExplorer";
import { usePlayground } from "@/features/playground/hooks/usePlayground";
import { useAISuggestions } from "@/features/playground/hooks/useAISuggestion";
import { useWebContainer } from "@/features/webcontainers/hooks/useWebContainer";

import { TemplateFolder } from "@/features/playground/types";
import { findFilePath } from "@/features/playground/libs";
import { ConfirmationDialog } from "@/features/playground/components/dialogs/conformation-dialog";
import type { TemplateFile } from "@/features/playground/libs/path-to-json";
import { cn } from "@/lib/utils";

type ViewMode = "code" | "preview" | "split";

const MainPlaygroundPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // UI state
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => { },
    onCancel: () => { },
  });

  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);

  // Custom hooks
  const { playgroundData, templateData, isLoading, error, saveTemplateData } =
    usePlayground(id);
  const aiSuggestions = useAISuggestions();
  const {
    activeFileId,
    closeAllFiles,
    openFile,
    closeFile,
    updateFileContent,
    handleAddFile,
    handleAddFolder,
    handleDeleteFile,
    handleDeleteFolder,
    handleRenameFile,
    handleRenameFolder,
    openFiles,
    setTemplateData,
    setActiveFileId,
    setPlaygroundId,
    setOpenFiles,
    syncFromFS,
  } = useFileExplorer();

  const {
    serverUrl,
    isLoading: containerLoading,
    error: containerError,
    instance,
    writeFileSync,
    // @ts-expect-error - templateData type mismatch is handled at runtime
  } = useWebContainer({ templateData });

  const lastSyncedContent = useRef<Map<string, string>>(new Map());
  const boltTerminalRef = useRef<TerminalRef | null>(null);

  // FS Watcher - Sync terminal changes to UI tree
  useEffect(() => {
    if (!instance || !instance.fs) return;

    let timeoutId: NodeJS.Timeout;

    const watcher = instance.fs.watch("/", { recursive: true }, () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        syncFromFS(instance);
      }, 500);
    });

    return () => {
      watcher.close();
      clearTimeout(timeoutId);
    };
  }, [instance, syncFromFS]);

  // Set template data when playground loads
  useEffect(() => {
    setPlaygroundId(id);
  }, [id, setPlaygroundId]);

  useEffect(() => {
    if (templateData && !openFiles.length) {
      setTemplateData(templateData);
    }
  }, [templateData, setTemplateData, openFiles.length]);

  // Wrapper functions
  const wrappedHandleAddFile = useCallback(
    (newFile: TemplateFile, parentPath: string) => {
      return handleAddFile(
        newFile,
        parentPath,
        writeFileSync!,
        instance,
        saveTemplateData
      );
    },
    [handleAddFile, writeFileSync, instance, saveTemplateData]
  );

  const wrappedHandleAddFolder = useCallback(
    (newFolder: TemplateFolder, parentPath: string) => {
      return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
    },
    [handleAddFolder, instance, saveTemplateData]
  );

  const wrappedHandleDeleteFile = useCallback(
    (file: TemplateFile, parentPath: string) => {
      return handleDeleteFile(file, parentPath, instance, saveTemplateData);
    },
    [handleDeleteFile, instance, saveTemplateData]
  );

  const wrappedHandleDeleteFolder = useCallback(
    (folder: TemplateFolder, parentPath: string) => {
      return handleDeleteFolder(folder, parentPath, instance, saveTemplateData);
    },
    [handleDeleteFolder, instance, saveTemplateData]
  );

  const wrappedHandleRenameFile = useCallback(
    (
      file: TemplateFile,
      newFilename: string,
      newExtension: string,
      parentPath: string
    ) => {
      return handleRenameFile(
        file,
        newFilename,
        newExtension,
        parentPath,
        instance,
        saveTemplateData
      );
    },
    [handleRenameFile, instance, saveTemplateData]
  );

  const wrappedHandleRenameFolder = useCallback(
    (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
      return handleRenameFolder(
        folder,
        newFolderName,
        parentPath,
        instance,
        saveTemplateData
      );
    },
    [handleRenameFolder, instance, saveTemplateData]
  );

  const activeFile = openFiles.find((file) => file.id === activeFileId);
  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

  const handleFileSelect = (file: TemplateFile) => {
    openFile(file);
  };

  const handleSave = useCallback(
    async (fileId?: string) => {
      const targetFileId = fileId || activeFileId;
      if (!targetFileId) return;

      const fileToSave = openFiles.find((f) => f.id === targetFileId);
      if (!fileToSave) return;

      const latestTemplateData = useFileExplorer.getState().templateData;
      if (!latestTemplateData) return;

      try {
        const filePath = findFilePath(fileToSave, latestTemplateData);
        if (!filePath) {
          toast.error(
            `Could not find path for file: ${fileToSave.filename}.${fileToSave.fileExtension}`
          );
          return;
        }

        const updatedTemplateData = JSON.parse(
          JSON.stringify(latestTemplateData)
        );
        const updateFileContentInTree = (items: (TemplateFile | TemplateFolder | Record<string, unknown>)[]): (TemplateFile | TemplateFolder | Record<string, unknown>)[] =>
          items.map((item) => {
            if ("folderName" in item) {
              return { ...item, items: updateFileContentInTree((item as TemplateFolder).items) };
            } else if (
              "filename" in item &&
              (item as TemplateFile).filename === fileToSave.filename &&
              (item as TemplateFile).fileExtension === fileToSave.fileExtension
            ) {
              return { ...item, content: fileToSave.content };
            }
            return item;
          });
        updatedTemplateData.items = updateFileContentInTree(
          updatedTemplateData.items
        );

        if (writeFileSync) {
          await writeFileSync(filePath, fileToSave.content);
          lastSyncedContent.current.set(fileToSave.id, fileToSave.content);
          if (instance && instance.fs) {
            await instance.fs.writeFile(filePath, fileToSave.content);
          }
        }

        await saveTemplateData(updatedTemplateData);
        setTemplateData(updatedTemplateData);

        const updatedOpenFiles = openFiles.map((f) =>
          f.id === targetFileId
            ? {
              ...f,
              content: fileToSave.content,
              originalContent: fileToSave.content,
              hasUnsavedChanges: false,
            }
            : f
        );
        setOpenFiles(updatedOpenFiles);

        toast.success(
          `Saved ${fileToSave.filename}.${fileToSave.fileExtension}`
        );
      } catch (error) {
        console.error("Error saving file:", error);
        toast.error(
          `Failed to save ${fileToSave.filename}.${fileToSave.fileExtension}`
        );
        throw error;
      }
    },
    [
      activeFileId,
      openFiles,
      writeFileSync,
      instance,
      saveTemplateData,
      setTemplateData,
      setOpenFiles,
    ]
  );

  const handleSaveAll = async () => {
    const unsavedFiles = openFiles.filter((f) => f.hasUnsavedChanges);
    if (unsavedFiles.length === 0) {
      toast.info("No unsaved changes");
      return;
    }
    try {
      await Promise.all(unsavedFiles.map((f) => handleSave(f.id)));
      toast.success(`Saved ${unsavedFiles.length} file(s)`);
    } catch {
      toast.error("Failed to save some files");
    }
  };

  const handleExportZip = async () => {
    if (!templateData) {
      toast.error("No template data to export");
      return;
    }
    try {
      const zip = new JSZip();
      const addToZip = (items: (TemplateFile | TemplateFolder)[], folder: JSZip) => {
        for (const item of items) {
          if ("folderName" in item) {
            const subFolder = folder.folder(item.folderName)!;
            addToZip(item.items || [], subFolder);
          } else {
            const fileName = item.fileExtension
              ? `${item.filename}.${item.fileExtension}`
              : item.filename;
            folder.file(fileName, item.content || "");
          }
        }
      };
      addToZip(templateData.items || [], zip);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${playgroundData?.name || "playground"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Source code exported as ZIP!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export source code");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Terminal write handler for setup logs
  const handleTerminalWrite = useCallback((data: string) => {
    if (boltTerminalRef.current?.writeToTerminal) {
      boltTerminalRef.current.writeToTerminal(data);
    }
  }, []);

  // Build breadcrumb path from active file
  const getBreadcrumb = () => {
    if (!activeFile || !templateData) return [];
    const fileName = `${activeFile.filename}.${activeFile.fileExtension}`;

    const findPath = (items: (TemplateFile | TemplateFolder)[], path: string[]): string[] | null => {
      for (const item of items) {
        if ("folderName" in item) {
          const folder = item as TemplateFolder;
          const result = findPath(folder.items as (TemplateFile | TemplateFolder)[], [...path, folder.folderName]);
          if (result) return result;
        } else if (
          (item as TemplateFile).filename === activeFile.filename &&
          (item as TemplateFile).fileExtension === activeFile.fileExtension
        ) {
          return [...path, fileName];
        }
      }
      return null;
    };

    return findPath(templateData.items as (TemplateFile | TemplateFolder)[] || [], []) || [fileName];
  };

  const isCodeVisible = viewMode === "code" || viewMode === "split";
  const isPreviewVisible = viewMode === "preview" || viewMode === "split";

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#11111B] p-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-red-400 mb-2">
          Something went wrong
        </h2>
        <p className="text-[#6C7086] mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="destructive">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#11111B] p-4">
        <div className="w-full max-w-md p-6 rounded-lg bg-[#1E1E2E] border border-[#313244]">
          <h2 className="text-lg font-semibold mb-6 text-center text-[#CDD6F4]">
            Loading Playground
          </h2>
          <div className="mb-6 space-y-3">
            <LoadingStep
              currentStep={1}
              step={1}
              label="Loading playground data"
            />
            <LoadingStep
              currentStep={2}
              step={2}
              label="Setting up environment"
            />
            <LoadingStep currentStep={3} step={3} label="Ready to code" />
          </div>
        </div>
      </div>
    );
  }

  // No template data
  if (!templateData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#11111B] p-4">
        <FolderOpen className="h-12 w-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-semibold text-amber-400 mb-2">
          No template data available
        </h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Template
        </Button>
      </div>
    );
  }

  const breadcrumb = getBreadcrumb();

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-[#11111B] text-[#CDD6F4] overflow-hidden">
        {/* ─── Header ─── */}
        <header className="h-11 flex items-center justify-between px-3 border-b border-[#313244] bg-[#181825] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-[#CDD6F4]">
                {playgroundData?.name || "Code Playground"}
              </span>
            </div>
            {hasUnsavedChanges && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                Unsaved
              </span>
            )}
          </div>

          {/* ─── View Mode Switcher (Code / Preview) ─── */}
          <div className="flex items-center gap-0.5 bg-[#11111B] rounded-lg p-0.5 border border-[#313244]">
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                viewMode === "code"
                  ? "bg-[#313244] text-[#CDD6F4] shadow-sm"
                  : "text-[#6C7086] hover:text-[#BAC2DE]"
              )}
              onClick={() => setViewMode("code")}
            >
              <Code className="h-3.5 w-3.5" />
              Code
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                viewMode === "split"
                  ? "bg-[#313244] text-[#CDD6F4] shadow-sm"
                  : "text-[#6C7086] hover:text-[#BAC2DE]"
              )}
              onClick={() => setViewMode("split")}
            >
              Split
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                viewMode === "preview"
                  ? "bg-[#313244] text-[#CDD6F4] shadow-sm"
                  : "text-[#6C7086] hover:text-[#BAC2DE]"
              )}
              onClick={() => setViewMode("preview")}
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 rounded hover:bg-[#313244] text-[#BAC2DE] hover:text-[#CDD6F4] transition-colors disabled:opacity-30"
                  onClick={() => handleSave()}
                  disabled={!activeFile || !activeFile.hasUnsavedChanges}
                >
                  <Save className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Save (Ctrl+S)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 rounded hover:bg-[#313244] text-[#BAC2DE] hover:text-[#CDD6F4] transition-colors disabled:opacity-30"
                  onClick={handleSaveAll}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Save All</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-[#313244] mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    isBottomPanelVisible
                      ? "bg-[#313244] text-[#CDD6F4]"
                      : "text-[#BAC2DE] hover:bg-[#313244] hover:text-[#CDD6F4]"
                  )}
                  onClick={() =>
                    setIsBottomPanelVisible(!isBottomPanelVisible)
                  }
                >
                  <TerminalIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isBottomPanelVisible ? "Hide" : "Show"} Terminal
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-[#313244] mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 rounded hover:bg-[#313244] text-[#BAC2DE] hover:text-[#CDD6F4] transition-colors"
                  onClick={handleExportZip}
                >
                  <Download className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Export as ZIP</TooltipContent>
            </Tooltip>

            <ToggleAI
              isEnabled={aiSuggestions.isEnabled}
              onToggle={aiSuggestions.toggleEnabled}
              suggestionLoading={aiSuggestions.isLoading}
              playgroundId={id}
            />
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* ─── File Explorer ─── */}
            {isCodeVisible && (
              <>
                <ResizablePanel defaultSize={18} minSize={12} maxSize={35}>
                  <TemplateFileTree
                    data={templateData}
                    onFileSelect={handleFileSelect}
                    selectedFile={activeFile}
                    title="Files"
                    onAddFile={wrappedHandleAddFile}
                    onAddFolder={wrappedHandleAddFolder}
                    onDeleteFile={wrappedHandleDeleteFile}
                    onDeleteFolder={wrappedHandleDeleteFolder}
                    onRenameFile={wrappedHandleRenameFile}
                    onRenameFolder={wrappedHandleRenameFolder}
                  />
                </ResizablePanel>

                <ResizableHandle className="w-[1px] bg-[#313244] hover:bg-[#89B4FA] transition-colors" />
              </>
            )}

            {/* ─── Editor + Terminal ─── */}
            {isCodeVisible && (
              <>
                <ResizablePanel defaultSize={isPreviewVisible ? 42 : 82}>
                  <ResizablePanelGroup direction="vertical" className="h-full">
                    {/* Editor Area */}
                    <ResizablePanel defaultSize={isBottomPanelVisible ? 65 : 100}>
                      <div className="h-full flex flex-col bg-[#1E1E2E]">
                        {openFiles.length > 0 ? (
                          <>
                            {/* File Tabs */}
                            <div className="flex items-center bg-[#181825] border-b border-[#313244] overflow-x-auto shrink-0">
                              {openFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className={cn(
                                    "flex items-center gap-1.5 h-[34px] px-3 cursor-pointer border-r border-[#313244] group transition-colors shrink-0",
                                    file.id === activeFileId
                                      ? "bg-[#1E1E2E] text-[#CDD6F4] border-t-2 border-t-[#89B4FA]"
                                      : "bg-[#11111B] text-[#6C7086] hover:text-[#BAC2DE] border-t-2 border-t-transparent"
                                  )}
                                  onClick={() => setActiveFileId(file.id)}
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-xs whitespace-nowrap">
                                    {file.filename}.{file.fileExtension}
                                  </span>
                                  {file.hasUnsavedChanges && (
                                    <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                                  )}
                                  <button
                                    className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#313244] transition-all shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      closeFile(file.id);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}

                              <div className="flex-1" />

                              {openFiles.length > 1 && (
                                <button
                                  className="px-2 text-[10px] text-[#6C7086] hover:text-[#CDD6F4] transition-colors shrink-0"
                                  onClick={closeAllFiles}
                                >
                                  Close All
                                </button>
                              )}
                            </div>

                            {/* Breadcrumb */}
                            {breadcrumb.length > 0 && (
                              <div className="flex items-center gap-1 px-3 py-1 bg-[#181825] border-b border-[#313244] shrink-0">
                                {breadcrumb.map((part, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && (
                                      <ChevronRight className="h-3 w-3 text-[#45475A]" />
                                    )}
                                    <span
                                      className={cn(
                                        "text-xs",
                                        i === breadcrumb.length - 1
                                          ? "text-[#CDD6F4]"
                                          : "text-[#6C7086] hover:text-[#BAC2DE] cursor-pointer"
                                      )}
                                    >
                                      {part}
                                    </span>
                                  </React.Fragment>
                                ))}
                                {activeFile?.hasUnsavedChanges && (
                                  <span className="ml-2 h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
                                )}
                                <div className="flex-1" />
                                {activeFile?.hasUnsavedChanges && (
                                  <button
                                    className="text-[10px] text-[#89B4FA] hover:text-[#B4D0FB] transition-colors"
                                    onClick={() => handleSave()}
                                  >
                                    Save
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Monaco Editor */}
                            <div className="flex-1 min-h-0">
                              <PlaygroundEditor
                                activeFile={activeFile}
                                content={activeFile?.content || ""}
                                onContentChange={(value) =>
                                  activeFileId &&
                                  updateFileContent(activeFileId, value)
                                }
                                suggestion={aiSuggestions.suggestion}
                                suggestionLoading={aiSuggestions.isLoading}
                                suggestionPosition={aiSuggestions.position}
                                onAcceptSuggestion={(editor, monaco) =>
                                  aiSuggestions.acceptSuggestion(editor, monaco)
                                }
                                onRejectSuggestion={(editor) =>
                                  aiSuggestions.rejectSuggestion(editor)
                                }
                                onTriggerSuggestion={(type, editor) =>
                                  aiSuggestions.fetchSuggestion(type, editor)
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col h-full items-center justify-center text-[#6C7086] gap-4">
                            <FileText className="h-16 w-16 text-[#313244]" />
                            <div className="text-center">
                              <p className="text-sm font-medium text-[#BAC2DE]">
                                No files open
                              </p>
                              <p className="text-xs text-[#6C7086] mt-1">
                                Select a file from the explorer to start editing
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </ResizablePanel>

                    {/* Bottom Panel (Terminal Tabs) */}
                    {isBottomPanelVisible && (
                      <>
                        <ResizableHandle className="h-[1px] bg-[#313244] hover:bg-[#89B4FA] transition-colors" />
                        <ResizablePanel defaultSize={35} minSize={15} maxSize={60}>
                          <TerminalTabs
                            webContainerInstance={instance}
                            onClose={() => setIsBottomPanelVisible(false)}
                            className="h-full"
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </ResizablePanel>
              </>
            )}

            {/* ─── Preview Panel ─── */}
            {isPreviewVisible && (
              <>
                {isCodeVisible && (
                  <ResizableHandle className="w-[1px] bg-[#313244] hover:bg-[#89B4FA] transition-colors" />
                )}
                <ResizablePanel defaultSize={isCodeVisible ? 40 : 100} minSize={20}>
                  <WebContainerPreview
                    templateData={templateData}
                    instance={instance}
                    writeFileSync={writeFileSync}
                    isLoading={containerLoading}
                    error={containerError}
                    serverUrl={serverUrl!}
                    forceResetup={false}
                    onTerminalWrite={handleTerminalWrite}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* ─── Status Bar ─── */}
        <footer className="h-6 flex items-center justify-between px-3 border-t border-[#313244] bg-[#181825] text-[10px] text-[#6C7086] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  instance ? "bg-green-400" : "bg-red-400"
                )}
              />
              {instance ? "Connected" : "Disconnected"}
            </span>
            {hasUnsavedChanges && (
              <span className="text-amber-400">● Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeFile && (
              <span>
                {activeFile.filename}.{activeFile.fileExtension}
              </span>
            )}
            <span>{activeFile?.fileExtension?.toUpperCase() || "TEXT"}</span>
            <span>UTF-8</span>
          </div>
        </footer>
      </div>

      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        onConfirm={confirmationDialog.onConfirm}
        onCancel={confirmationDialog.onCancel}
        setIsOpen={(open) =>
          setConfirmationDialog((prev) => ({ ...prev, isOpen: open }))
        }
      />
    </TooltipProvider>
  );
};

export default MainPlaygroundPage;
