"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { toast } from "sonner"
import {
    Search,
    Star,
    Lock,
    Globe,
    GitBranch,
    AlertCircle,
    FolderGit2,
    ArrowRight,
    RefreshCw,
} from "lucide-react"
import { createPlaygroundFromGitHub } from "@/features/playground/actions"

interface GitHubRepo {
    id: number
    name: string
    full_name: string
    description: string | null
    private: boolean
    default_branch: string
    updated_at: string
    language: string | null
    stargazers_count: number
    owner: {
        login: string
        avatar_url: string
    }
}

interface GitHubUser {
    login: string
    name: string | null
    avatar_url: string
    public_repos: number
    total_private_repos: number
}

interface GitHubRepoModalProps {
    isOpen: boolean
    onClose: () => void
}

const LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Java: "#b07219",
    Go: "#00ADD8",
    Rust: "#dea584",
    Ruby: "#701516",
    PHP: "#4F5D95",
    "C++": "#f34b7d",
    C: "#555555",
    "C#": "#178600",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    Vue: "#41b883",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Shell: "#89e051",
    Lua: "#000080",
}

function getRelativeTime(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString()
}

export default function GitHubRepoModal({ isOpen, onClose }: GitHubRepoModalProps) {
    const router = useRouter()
    const [repos, setRepos] = useState<GitHubRepo[]>([])
    const [user, setUser] = useState<GitHubUser | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [importingRepo, setImportingRepo] = useState<string | null>(null)
    const [importProgress, setImportProgress] = useState("")
    const [hoveredRepo, setHoveredRepo] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen) {
            fetchRepos()
            fetchUser()
        } else {
            setSearchQuery("")
            setError(null)
            setImportingRepo(null)
            setImportProgress("")
            setHoveredRepo(null)
        }
    }, [isOpen])

    const fetchUser = async () => {
        try {
            const res = await fetch("/api/github/user")
            if (res.ok) {
                const data = await res.json()
                setUser(data.user ?? data)
            }
        } catch {
            // silently fail — will fall back to repo owner info
        }
    }

    const fetchRepos = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/github/repos")
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to fetch repositories")
            }
            const data = await res.json()
            setRepos(data.repos)
            // Derive user from first repo's owner if /api/github/user hasn't resolved yet
            if (data.repos?.length > 0 && !user) {
                const owner = data.repos[0].owner
                setUser((prev) => prev ?? {
                    login: owner.login,
                    name: owner.login,
                    avatar_url: owner.avatar_url,
                    public_repos: data.repos.length,
                    total_private_repos: 0,
                })
            }
        } catch (err: any) {
            setError(err.message || "Failed to load repositories")
        } finally {
            setIsLoading(false)
        }
    }

    const filteredRepos = useMemo(() => {
        if (!searchQuery.trim()) return repos
        const q = searchQuery.toLowerCase()
        return repos.filter(
            (repo) =>
                repo.name.toLowerCase().includes(q) ||
                repo.full_name.toLowerCase().includes(q) ||
                (repo.description && repo.description.toLowerCase().includes(q)) ||
                (repo.language && repo.language.toLowerCase().includes(q))
        )
    }, [repos, searchQuery])

    const handleImportRepo = async (repo: GitHubRepo) => {
        setImportingRepo(repo.full_name)
        setImportProgress("Fetching repository contents...")
        try {
            const res = await fetch(`/api/github/repos/${repo.owner.login}/${repo.name}/contents`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to fetch repository contents")
            }
            setImportProgress("Creating playground...")
            const data = await res.json()
            const playground = await createPlaygroundFromGitHub({
                title: repo.name,
                description: repo.description || undefined,
                templateData: data.templateData,
            })
            toast.success(`Imported "${repo.name}" successfully`)
            onClose()
            router.push(`/playground/${playground.id}`)
        } catch (err: any) {
            toast.error(err.message || "Failed to import repository")
            setImportingRepo(null)
            setImportProgress("")
        }
    }

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@500;600;700&display=swap');

                .gh-modal-overlay [role="dialog"] {
                    background: #0d0d0f !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    border-radius: 16px !important;
                    box-shadow:
                        0 0 0 1px rgba(233,63,63,0.06),
                        0 32px 80px rgba(0,0,0,0.6),
                        0 0 120px rgba(233,63,63,0.04) !important;
                    font-family: 'Syne', sans-serif !important;
                }

                .gh-modal-content {
                    font-family: 'Syne', sans-serif;
                    color: #e8e8e8;
                }

                .gh-search-input {
                    font-family: 'IBM Plex Mono', monospace !important;
                    font-size: 13px !important;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    color: #e8e8e8 !important;
                    border-radius: 8px !important;
                    transition: border-color 0.2s, box-shadow 0.2s !important;
                }

                .gh-search-input:focus {
                    border-color: rgba(233,63,63,0.4) !important;
                    box-shadow: 0 0 0 3px rgba(233,63,63,0.08) !important;
                    outline: none !important;
                }

                .gh-search-input::placeholder {
                    color: rgba(255,255,255,0.22) !important;
                }

                .gh-repo-card {
                    position: relative;
                    width: 100%;
                    text-align: left;
                    padding: 14px 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.07);
                    background: rgba(255,255,255,0.025);
                    cursor: pointer;
                    transition: all 0.18s ease;
                    overflow: hidden;
                }

                .gh-repo-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(233,63,63,0.06) 0%, transparent 60%);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .gh-repo-card:hover {
                    border-color: rgba(233,63,63,0.3);
                    background: rgba(233,63,63,0.04);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(233,63,63,0.1);
                }

                .gh-repo-card:hover::before {
                    opacity: 1;
                }

                .gh-repo-card:active {
                    transform: translateY(0px);
                }

                .gh-repo-card:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    transform: none;
                }

                .gh-repo-name {
                    font-family: 'Syne', sans-serif;
                    font-weight: 600;
                    font-size: 14px;
                    letter-spacing: -0.01em;
                    color: #f0f0f0;
                    transition: color 0.15s;
                }

                .gh-repo-card:hover .gh-repo-name {
                    color: #ff6b6b;
                }

                .gh-repo-desc {
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 11px;
                    color: rgba(255,255,255,0.38);
                    line-height: 1.5;
                    margin-top: 4px;
                    margin-bottom: 10px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .gh-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 7px;
                    border-radius: 100px;
                    font-size: 10px;
                    font-weight: 600;
                    font-family: 'IBM Plex Mono', monospace;
                    letter-spacing: 0.02em;
                }

                .gh-badge-private {
                    background: rgba(245,158,11,0.1);
                    color: #f59e0b;
                    border: 1px solid rgba(245,158,11,0.2);
                }

                .gh-badge-public {
                    background: rgba(34,197,94,0.08);
                    color: #4ade80;
                    border: 1px solid rgba(34,197,94,0.18);
                }

                .gh-meta {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 11px;
                    color: rgba(255,255,255,0.3);
                }

                .gh-meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .gh-arrow {
                    color: rgba(233,63,63,0.5);
                    transform: translateX(-4px);
                    opacity: 0;
                    transition: all 0.18s ease;
                }

                .gh-repo-card:hover .gh-arrow {
                    opacity: 1;
                    transform: translateX(0);
                    color: #E93F3F;
                }

                .gh-divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent);
                    margin: 0;
                }

                .gh-title-accent {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #E93F3F;
                    box-shadow: 0 0 8px rgba(233,63,63,0.6);
                    margin-right: 2px;
                    vertical-align: middle;
                    position: relative;
                    top: -1px;
                }

                .gh-count-pill {
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 100px;
                    background: rgba(255,255,255,0.06);
                    color: rgba(255,255,255,0.35);
                    border: 1px solid rgba(255,255,255,0.08);
                }

                .gh-import-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 100;
                    background: rgba(0,0,0,0.75);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .gh-import-card {
                    background: #0d0d0f;
                    border: 1px solid rgba(233,63,63,0.2);
                    border-radius: 16px;
                    padding: 36px 48px;
                    text-align: center;
                    box-shadow: 0 0 60px rgba(233,63,63,0.08), 0 24px 80px rgba(0,0,0,0.5);
                    min-width: 300px;
                }

                .gh-spinner-ring {
                    width: 48px;
                    height: 48px;
                    border: 2px solid rgba(233,63,63,0.15);
                    border-top-color: #E93F3F;
                    border-radius: 50%;
                    animation: gh-spin 0.8s linear infinite;
                    margin: 0 auto 20px;
                }

                @keyframes gh-spin {
                    to { transform: rotate(360deg); }
                }

                .gh-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 64px 32px;
                    gap: 12px;
                    color: rgba(255,255,255,0.2);
                }

                .gh-error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 64px 32px;
                    gap: 12px;
                    text-align: center;
                }

                .gh-retry-btn {
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 12px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    background: rgba(233,63,63,0.1);
                    color: #ff6b6b;
                    border: 1px solid rgba(233,63,63,0.25);
                    cursor: pointer;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .gh-retry-btn:hover {
                    background: rgba(233,63,63,0.18);
                    border-color: rgba(233,63,63,0.4);
                }

                .gh-loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 64px 32px;
                    gap: 16px;
                }

                .gh-loading-dots {
                    display: flex;
                    gap: 6px;
                }

                .gh-loading-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #E93F3F;
                    animation: gh-pulse 1.2s ease-in-out infinite;
                }

                .gh-loading-dot:nth-child(2) { animation-delay: 0.2s; }
                .gh-loading-dot:nth-child(3) { animation-delay: 0.4s; }

                @keyframes gh-pulse {
                    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1); }
                }

                .gh-user-avatar-wrap {
                    position: relative;
                    display: inline-flex;
                    flex-shrink: 0;
                }

                .gh-user-avatar {
                    width: 52px;
                    height: 52px;
                    min-width: 52px;
                    min-height: 52px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.14);
                    object-fit: cover;
                    display: block;
                    background: rgba(255,255,255,0.06);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    flex-shrink: 0;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                }

                .gh-user-avatar:hover {
                    border-color: rgba(233,63,63,0.5);
                    box-shadow: 0 4px 20px rgba(233,63,63,0.2);
                }

                .gh-user-avatar:hover {
                    border-color: rgba(233,63,63,0.5);
                }

                .gh-user-avatar-skeleton {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                    background-size: 200% 100%;
                    animation: gh-shimmer 1.5s infinite;
                    flex-shrink: 0;
                }

                @keyframes gh-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                .gh-online-dot {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 11px;
                    height: 11px;
                    border-radius: 50%;
                    background: #4ade80;
                    border: 2px solid #0d0d0f;
                    box-shadow: 0 0 8px rgba(74,222,128,0.6);
                }

                .gh-user-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }

                .gh-user-name {
                    font-family: 'Syne', sans-serif;
                    font-weight: 600;
                    font-size: 13px;
                    color: #e8e8e8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 160px;
                }

                .gh-user-handle {
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 10px;
                    color: rgba(255,255,255,0.28);
                    white-space: nowrap;
                }

                .gh-connected-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 7px;
                    border-radius: 100px;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 9px;
                    font-weight: 500;
                    letter-spacing: 0.04em;
                    background: rgba(74,222,128,0.08);
                    color: #4ade80;
                    border: 1px solid rgba(74,222,128,0.2);
                    text-transform: uppercase;
                }


            `}</style>

            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="gh-modal-overlay sm:max-w-[660px] max-h-[88vh] flex flex-col p-0 gap-0">
                    <VisuallyHidden.Root>
                        <DialogTitle>Import GitHub Repository</DialogTitle>
                    </VisuallyHidden.Root>
                    <div className="gh-modal-content flex flex-col h-full" style={{ maxHeight: "88vh" }}>

                        {/* Header */}
                        <div style={{ padding: "24px 28px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                                {/* Title */}
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                                        <span className="gh-title-accent" />
                                        <h2 style={{
                                            fontFamily: "'Syne', sans-serif",
                                            fontWeight: 700,
                                            fontSize: 18,
                                            letterSpacing: "-0.02em",
                                            color: "#f5f5f5",
                                            margin: 0,
                                        }}>
                                            Import Repository
                                        </h2>
                                    </div>
                                    <p style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.3)",
                                        margin: 0,
                                        letterSpacing: "0.01em",
                                    }}>
                                        Select a repo to open in your playground
                                    </p>
                                </div>

                                {/* User profile */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                    {user ? (
                                        <>
                                            <div style={{ textAlign: "right" }}>
                                                <div className="gh-user-name">{user.name || user.login}</div>
                                                <div className="gh-user-handle">@{user.login}</div>
                                            </div>
                                            <div className="gh-user-avatar-wrap">
                                                <img
                                                    src={user.avatar_url}
                                                    alt={user.login}
                                                    className="gh-user-avatar"
                                                    referrerPolicy="no-referrer"
                                                    onError={(e) => {
                                                        const target = e.currentTarget
                                                        target.style.display = "none"
                                                        const parent = target.parentElement
                                                        if (parent && !parent.querySelector(".gh-avatar-fallback")) {
                                                            const fallback = document.createElement("div")
                                                            fallback.className = "gh-avatar-fallback gh-user-avatar"
                                                            fallback.style.cssText = "display:flex;align-items:center;justify-content:center;background:rgba(233,63,63,0.15);color:#E93F3F;font-family:'Syne',sans-serif;font-weight:700;font-size:18px;width:52px;height:52px;border-radius:50%;flex-shrink:0;"
                                                            fallback.textContent = user.login.charAt(0).toUpperCase()
                                                            parent.insertBefore(fallback, target)
                                                        }
                                                    }}
                                                />
                                                <span className="gh-online-dot" title="Connected" />
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ textAlign: "right" }}>
                                                <div style={{ width: 80, height: 10, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 5 }} />
                                                <div style={{ width: 56, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
                                            </div>
                                            <div className="gh-user-avatar-skeleton" />
                                        </div>                                    )}
                                </div>
                            </div>

                            {/* Connected badge row */}
                            {user && (
                                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className="gh-connected-badge">
                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                                        Connected
                                    </span>
                                    {repos.length > 0 && (
                                        <span className="gh-count-pill">{filteredRepos.length} / {repos.length} repos</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="gh-divider" />

                        {/* Search */}
                        <div style={{ padding: "16px 28px" }}>
                            <div style={{ position: "relative" }}>
                                <Search style={{
                                    position: "absolute",
                                    left: 13,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 14,
                                    height: 14,
                                    color: "rgba(255,255,255,0.25)",
                                    pointerEvents: "none",
                                }} />
                                <input
                                    className="gh-search-input"
                                    placeholder="Search by name, language, or description..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "9px 12px 9px 36px",
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        </div>

                        <div className="gh-divider" />

                        {/* Repo List */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px 24px", minHeight: 0 }} className="gh-scroll-area">

                            {/* Loading */}
                            {isLoading && (
                                <div className="gh-loading-state">
                                    <div className="gh-loading-dots">
                                        <div className="gh-loading-dot" />
                                        <div className="gh-loading-dot" />
                                        <div className="gh-loading-dot" />
                                    </div>
                                    <p style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.25)",
                                        margin: 0,
                                    }}>
                                        Fetching repositories...
                                    </p>
                                </div>
                            )}

                            {/* Error */}
                            {error && !isLoading && (
                                <div className="gh-error-state">
                                    <AlertCircle style={{ width: 28, height: 28, color: "#ef4444" }} />
                                    <p style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        color: "#ef4444",
                                        margin: 0,
                                    }}>
                                        {error}
                                    </p>
                                    <button className="gh-retry-btn" onClick={fetchRepos}>
                                        <RefreshCw style={{ width: 12, height: 12 }} />
                                        Retry
                                    </button>
                                </div>
                            )}

                            {/* No results from search */}
                            {!isLoading && !error && filteredRepos.length === 0 && repos.length > 0 && (
                                <div className="gh-empty-state">
                                    <Search style={{ width: 28, height: 28 }} />
                                    <p style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        margin: 0,
                                    }}>
                                        No matches for "{searchQuery}"
                                    </p>
                                </div>
                            )}

                            {/* No repos at all */}
                            {!isLoading && !error && repos.length === 0 && (
                                <div className="gh-empty-state">
                                    <FolderGit2 style={{ width: 28, height: 28 }} />
                                    <p style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        margin: 0,
                                    }}>
                                        No repositories found
                                    </p>
                                </div>
                            )}

                            {/* Repo cards */}
                            {!isLoading && !error && filteredRepos.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {filteredRepos.map((repo, index) => (
                                        <button
                                            key={repo.id}
                                            className="gh-repo-card"
                                            onClick={() => handleImportRepo(repo)}
                                            disabled={!!importingRepo}
                                            style={{ animationDelay: `${index * 30}ms` }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>

                                                    {/* Name row */}
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: repo.description ? 4 : 8 }}>
                                                        <span className="gh-repo-name">{repo.name}</span>
                                                        <span className={`gh-badge ${repo.private ? "gh-badge-private" : "gh-badge-public"}`}>
                                                            {repo.private
                                                                ? <><Lock style={{ width: 9, height: 9 }} /> Private</>
                                                                : <><Globe style={{ width: 9, height: 9 }} /> Public</>
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Description */}
                                                    {repo.description && (
                                                        <p className="gh-repo-desc">{repo.description}</p>
                                                    )}

                                                    {/* Meta */}
                                                    <div className="gh-meta">
                                                        {repo.language && (
                                                            <span className="gh-meta-item">
                                                                <span style={{
                                                                    width: 8,
                                                                    height: 8,
                                                                    borderRadius: "50%",
                                                                    background: LANGUAGE_COLORS[repo.language] || "#8b8b8b",
                                                                    display: "inline-block",
                                                                    flexShrink: 0,
                                                                }} />
                                                                {repo.language}
                                                            </span>
                                                        )}
                                                        {repo.stargazers_count > 0 && (
                                                            <span className="gh-meta-item">
                                                                <Star style={{ width: 10, height: 10 }} />
                                                                {repo.stargazers_count.toLocaleString()}
                                                            </span>
                                                        )}
                                                        <span className="gh-meta-item">
                                                            <GitBranch style={{ width: 10, height: 10 }} />
                                                            {repo.default_branch}
                                                        </span>
                                                        <span style={{ marginLeft: "auto" }}>
                                                            {getRelativeTime(repo.updated_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <ArrowRight className="gh-arrow" style={{ width: 16, height: 16, flexShrink: 0 }} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Import overlay */}
                    {importingRepo && (
                        <div className="gh-import-overlay">
                            <div className="gh-import-card">
                                <div className="gh-spinner-ring" />
                                <p style={{
                                    fontFamily: "'Syne', sans-serif",
                                    fontWeight: 600,
                                    fontSize: 16,
                                    color: "#f0f0f0",
                                    margin: "0 0 8px",
                                    letterSpacing: "-0.01em",
                                }}>
                                    Importing
                                </p>
                                <p style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.4)",
                                    margin: "0 0 6px",
                                }}>
                                    {importingRepo}
                                </p>
                                <p style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    fontSize: 11,
                                    color: "rgba(233,63,63,0.6)",
                                    margin: 0,
                                }}>
                                    {importProgress}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}