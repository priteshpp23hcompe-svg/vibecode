"use client"

import * as React from "react"
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit3,
  Search,
  FileCode2,
  FileJson,
  FileType,
  FileImage,
  Settings2,
  Copy,
  X,
} from "lucide-react"
import * as ContextMenu from "@radix-ui/react-context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Using the provided interfaces
interface TemplateFile {
  filename: string
  fileExtension: string
  content: string
}

interface TemplateFolder {
  folderName: string
  items: (TemplateFile | TemplateFolder)[]
}

type TemplateItem = TemplateFile | TemplateFolder

interface TemplateFileTreeProps {
  data: TemplateItem
  onFileSelect?: (file: TemplateFile) => void
  selectedFile?: TemplateFile
  title?: string
  onAddFile?: (file: TemplateFile, parentPath: string) => void
  onAddFolder?: (folder: TemplateFolder, parentPath: string) => void
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void
  onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void
  onRenameFile?: (file: TemplateFile, newFilename: string, newExtension: string, parentPath: string) => void
  onRenameFolder?: (folder: TemplateFolder, newFolderName: string, parentPath: string) => void
}

// ─── Constants ───
const NODE_PADDING_LEFT = 12
const DEFAULT_HIDDEN_PATTERNS = [/node_modules/, /\.next/, /\.astro/, /\.git$/]

// ─── File Icon Helper ───
function getFileIcon(extension: string) {
  const iconClass = "h-4 w-4 shrink-0"
  switch (extension?.toLowerCase()) {
    case "js":
    case "jsx":
      return <FileCode2 className={cn(iconClass, "text-yellow-400")} />
    case "ts":
    case "tsx":
      return <FileCode2 className={cn(iconClass, "text-blue-400")} />
    case "css":
    case "scss":
    case "sass":
      return <FileType className={cn(iconClass, "text-pink-400")} />
    case "json":
      return <FileJson className={cn(iconClass, "text-green-400")} />
    case "md":
    case "mdx":
      return <FileType className={cn(iconClass, "text-gray-400")} />
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "ico":
    case "webp":
      return <FileImage className={cn(iconClass, "text-purple-400")} />
    case "html":
      return <FileCode2 className={cn(iconClass, "text-orange-400")} />
    case "env":
    case "env.local":
      return <Settings2 className={cn(iconClass, "text-yellow-600")} />
    default:
      return <FileIcon className={cn(iconClass, "text-[#6C7086]")} />
  }
}

function isHiddenPath(path: string): boolean {
  return DEFAULT_HIDDEN_PATTERNS.some(pattern => pattern.test(path))
}

// ─── Context Menu Item ───
function ContextMenuItem({ onSelect, children, destructive = false }: { onSelect?: () => void; children: ReactNode; destructive?: boolean }) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer outline-none transition-colors",
        destructive
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-[#CDD6F4] hover:bg-[#313244] hover:text-white"
      )}
    >
      {children}
    </ContextMenu.Item>
  )
}

// ─── Inline Input (for new file/folder creation) ───
function InlineInput({
  depth,
  placeholder,
  initialValue = "",
  onSubmit,
  onCancel,
}: {
  depth: number
  placeholder: string
  initialValue?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        if (initialValue) {
          inputRef.current.value = initialValue
          inputRef.current.select()
        }
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [initialValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const value = inputRef.current?.value.trim()
      if (value) onSubmit(value)
    } else if (e.key === "Escape") {
      onCancel()
    }
  }

  return (
    <div
      className="flex items-center w-full px-2 bg-[#313244] border border-[#89B4FA] py-0.5"
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
    >
      <FilePlus className="h-3.5 w-3.5 shrink-0 text-[#6C7086]" />
      <input
        ref={inputRef}
        type="text"
        className="ml-2 flex-1 bg-transparent border-none outline-none py-0.5 text-xs text-[#CDD6F4] placeholder:text-[#6C7086] min-w-0"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== inputRef.current) {
              onCancel()
            }
          }, 100)
        }}
      />
    </div>
  )
}

// ─── Main FileTree Component ───
export function TemplateFileTree({
  data,
  onFileSelect,
  selectedFile,
  title = "Files",
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
}: TemplateFileTreeProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [isCreatingRootFile, setIsCreatingRootFile] = useState(false)
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false)

  const handleCreateRootFile = useCallback((filename: string) => {
    if (!onAddFile) return
    const parts = filename.split(".")
    const ext = parts.length > 1 ? parts.pop()! : ""
    const name = parts.join(".")
    onAddFile({ filename: name, fileExtension: ext, content: "" }, "")
    setIsCreatingRootFile(false)
  }, [onAddFile])

  const handleCreateRootFolder = useCallback((folderName: string) => {
    if (!onAddFolder) return
    onAddFolder({ folderName, items: [] }, "")
    setIsCreatingRootFolder(false)
  }, [onAddFolder])

  return (
    <div className="h-full flex flex-col bg-[#11111B] border-r border-[#313244]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-[34px] border-b border-[#313244] bg-[#181825] shrink-0">
        <span className="text-xs font-semibold text-[#BAC2DE] uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            title="Search files"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={() => setIsCreatingRootFile(true)}
            title="New file"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-[#313244] text-[#6C7086] hover:text-[#CDD6F4] transition-colors"
            onClick={() => setIsCreatingRootFolder(true)}
            title="New folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      {isSearchVisible && (
        <div className="px-2 py-1.5 border-b border-[#313244] bg-[#181825]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6C7086]" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 bg-[#1E1E2E] border border-[#313244] rounded text-xs text-[#CDD6F4] placeholder:text-[#6C7086] outline-none focus:border-[#89B4FA] transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6C7086] hover:text-[#CDD6F4]"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isCreatingRootFile && (
            <InlineInput
              depth={0}
              placeholder="Enter file name..."
              onSubmit={handleCreateRootFile}
              onCancel={() => setIsCreatingRootFile(false)}
            />
          )}
          {isCreatingRootFolder && (
            <InlineInput
              depth={0}
              placeholder="Enter folder name..."
              onSubmit={handleCreateRootFolder}
              onCancel={() => setIsCreatingRootFolder(false)}
            />
          )}
          {"folderName" in data && (data as TemplateFolder).items
            .filter(item => !isHiddenPath("folderName" in item ? (item as TemplateFolder).folderName : `${(item as TemplateFile).filename}.${(item as TemplateFile).fileExtension}`))
            .sort((a, b) => {
              // Folders first, then files
              const aIsFolder = "folderName" in a
              const bIsFolder = "folderName" in b
              if (aIsFolder && !bIsFolder) return -1
              if (!aIsFolder && bIsFolder) return 1
              const aName = aIsFolder ? (a as TemplateFolder).folderName : (a as TemplateFile).filename
              const bName = bIsFolder ? (b as TemplateFolder).folderName : (b as TemplateFile).filename
              return aName.localeCompare(bName)
            })
            .map((item, index) => (
              <TemplateNode
                key={index}
                item={item}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
                level={0}
                path=""
                onAddFile={onAddFile}
                onAddFolder={onAddFolder}
                onDeleteFile={onDeleteFile}
                onDeleteFolder={onDeleteFolder}
                onRenameFile={onRenameFile}
                onRenameFolder={onRenameFolder}
                searchQuery={searchQuery}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Node Props ───
interface TemplateNodeProps {
  item: TemplateItem
  onFileSelect?: (file: TemplateFile) => void
  selectedFile?: TemplateFile
  level: number
  path?: string
  onAddFile?: (file: TemplateFile, parentPath: string) => void
  onAddFolder?: (folder: TemplateFolder, parentPath: string) => void
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void
  onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void
  onRenameFile?: (file: TemplateFile, newFilename: string, newExtension: string, parentPath: string) => void
  onRenameFolder?: (folder: TemplateFolder, newFolderName: string, parentPath: string) => void
  searchQuery?: string
}

function matchesSearch(item: TemplateItem, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if ("filename" in item) {
    return `${item.filename}.${item.fileExtension}`.toLowerCase().includes(q)
  }
  if ("folderName" in item) {
    if (item.folderName.toLowerCase().includes(q)) return true
    return (item as TemplateFolder).items.some(child => matchesSearch(child, query))
  }
  return false
}

function TemplateNode({
  item,
  onFileSelect,
  selectedFile,
  level,
  path = "",
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
  searchQuery = "",
}: TemplateNodeProps) {
  const [expanded, setExpanded] = useState(level < 2)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Auto-expand when search matches
  useEffect(() => {
    if (searchQuery && "folderName" in item && matchesSearch(item, searchQuery)) {
      setExpanded(true)
    }
  }, [searchQuery, item])

  // Focus rename input
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  if (!matchesSearch(item, searchQuery)) return null

  // ─── FILE NODE ───
  if ("filename" in item && !("folderName" in item)) {
    const file = item as TemplateFile
    const fullName = file.fileExtension ? `${file.filename}.${file.fileExtension}` : file.filename
    const isSelected =
      selectedFile &&
      selectedFile.filename === file.filename &&
      selectedFile.fileExtension === file.fileExtension

    const handleRenameSubmit = (e?: React.FormEvent) => {
      e?.preventDefault()
      const newName = renameInputRef.current?.value.trim()
      if (!newName || !onRenameFile) {
        setIsRenaming(false)
        return
      }
      const parts = newName.split(".")
      const newExt = parts.length > 1 ? parts.pop()! : file.fileExtension
      const newFilename = parts.join(".")
      onRenameFile(file, newFilename, newExt, path)
      setIsRenaming(false)
    }

    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 w-full pr-2 py-[3px] text-xs transition-colors group border-l-2",
              isSelected
                ? "bg-[#313244] text-[#CDD6F4] border-l-[#89B4FA]"
                : "bg-transparent text-[#BAC2DE] hover:bg-[#1E1E2E] hover:text-[#CDD6F4] border-l-transparent"
            )}
            style={{ paddingLeft: `${6 + level * NODE_PADDING_LEFT}px` }}
            onClick={() => !isRenaming && onFileSelect?.(file)}
          >
            {getFileIcon(file.fileExtension)}
            {isRenaming ? (
              <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0">
                <input
                  ref={renameInputRef}
                  type="text"
                  defaultValue={fullName}
                  className="w-full bg-[#1E1E2E] border border-[#89B4FA] rounded px-1 py-0 text-xs text-[#CDD6F4] outline-none"
                  onBlur={() => handleRenameSubmit()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsRenaming(false)
                  }}
                />
              </form>
            ) : (
              <span className="truncate">{fullName}</span>
            )}
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            className="min-w-[180px] rounded-lg border border-[#313244] bg-[#1E1E2E] p-1 shadow-xl z-50"
          >
            <ContextMenuItem onSelect={() => setIsRenaming(true)}>
              <Edit3 className="h-3.5 w-3.5" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => {
              const filePath = path ? `${path}/${fullName}` : fullName
              navigator.clipboard.writeText(filePath)
              toast.success("Path copied")
            }}>
              <Copy className="h-3.5 w-3.5" />
              Copy Path
            </ContextMenuItem>
            <ContextMenu.Separator className="h-px bg-[#313244] my-1" />
            <ContextMenuItem destructive onSelect={() => onDeleteFile?.(file, path)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete File
            </ContextMenuItem>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    )
  }

  // ─── FOLDER NODE ───
  if ("folderName" in item) {
    const folder = item as TemplateFolder
    const currentPath = path ? `${path}/${folder.folderName}` : folder.folderName

    if (isHiddenPath(folder.folderName)) return null

    const handleCreateFile = (filename: string) => {
      if (!onAddFile) return
      const parts = filename.split(".")
      const ext = parts.length > 1 ? parts.pop()! : ""
      const name = parts.join(".")
      onAddFile({ filename: name, fileExtension: ext, content: "" }, currentPath)
      setIsCreatingFile(false)
    }

    const handleCreateFolder = (folderName: string) => {
      if (!onAddFolder) return
      onAddFolder({ folderName, items: [] }, currentPath)
      setIsCreatingFolder(false)
    }

    const handleRenameSubmit = (e?: React.FormEvent) => {
      e?.preventDefault()
      const newName = renameInputRef.current?.value.trim()
      if (!newName || !onRenameFolder) {
        setIsRenaming(false)
        return
      }
      onRenameFolder(folder, newName, path)
      setIsRenaming(false)
    }

    const sortedItems = [...folder.items]
      .filter(child => !isHiddenPath("folderName" in child ? (child as TemplateFolder).folderName : `${(child as TemplateFile).filename}.${(child as TemplateFile).fileExtension}`))
      .sort((a, b) => {
        const aIsFolder = "folderName" in a
        const bIsFolder = "folderName" in b
        if (aIsFolder && !bIsFolder) return -1
        if (!aIsFolder && bIsFolder) return 1
        const aName = aIsFolder ? (a as TemplateFolder).folderName : (a as TemplateFile).filename
        const bName = bIsFolder ? (b as TemplateFolder).folderName : (b as TemplateFile).filename
        return aName.localeCompare(bName)
      })

    return (
      <>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 w-full pr-2 py-[3px] text-xs transition-colors group",
                "text-[#BAC2DE] hover:bg-[#1E1E2E] hover:text-[#CDD6F4]"
              )}
              style={{ paddingLeft: `${6 + level * NODE_PADDING_LEFT}px` }}
              onClick={() => !isRenaming && setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#6C7086]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6C7086]" />
              )}
              {expanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-[#89B4FA]" />
              ) : (
                <FolderIcon className="h-4 w-4 shrink-0 text-[#89B4FA]" />
              )}
              {isRenaming ? (
                <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0">
                  <input
                    ref={renameInputRef}
                    type="text"
                    defaultValue={folder.folderName}
                    className="w-full bg-[#1E1E2E] border border-[#89B4FA] rounded px-1 py-0 text-xs text-[#CDD6F4] outline-none"
                    onBlur={() => handleRenameSubmit()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsRenaming(false)
                    }}
                  />
                </form>
              ) : (
                <span className="truncate font-medium">{folder.folderName}</span>
              )}
            </button>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content
              className="min-w-[180px] rounded-lg border border-[#313244] bg-[#1E1E2E] p-1 shadow-xl z-50"
            >
              <ContextMenuItem onSelect={() => { setIsCreatingFile(true); setExpanded(true) }}>
                <FilePlus className="h-3.5 w-3.5" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => { setIsCreatingFolder(true); setExpanded(true) }}>
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </ContextMenuItem>
              <ContextMenu.Separator className="h-px bg-[#313244] my-1" />
              <ContextMenuItem onSelect={() => setIsRenaming(true)}>
                <Edit3 className="h-3.5 w-3.5" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => {
                navigator.clipboard.writeText(currentPath)
                toast.success("Path copied")
              }}>
                <Copy className="h-3.5 w-3.5" />
                Copy Path
              </ContextMenuItem>
              <ContextMenu.Separator className="h-px bg-[#313244] my-1" />
              <ContextMenuItem destructive onSelect={() => onDeleteFolder?.(folder, path)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Folder
              </ContextMenuItem>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        {expanded && (
          <div>
            {isCreatingFile && (
              <InlineInput
                depth={level + 1}
                placeholder="Enter file name..."
                onSubmit={handleCreateFile}
                onCancel={() => setIsCreatingFile(false)}
              />
            )}
            {isCreatingFolder && (
              <InlineInput
                depth={level + 1}
                placeholder="Enter folder name..."
                onSubmit={handleCreateFolder}
                onCancel={() => setIsCreatingFolder(false)}
              />
            )}
            {sortedItems.map((childItem, index) => (
              <TemplateNode
                key={index}
                item={childItem}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
                level={level + 1}
                path={currentPath}
                onAddFile={onAddFile}
                onAddFolder={onAddFolder}
                onDeleteFile={onDeleteFile}
                onDeleteFolder={onDeleteFolder}
                onRenameFile={onRenameFile}
                onRenameFolder={onRenameFolder}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  return null
}
