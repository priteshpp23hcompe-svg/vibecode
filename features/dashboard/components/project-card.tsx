import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import type { Project } from "../types"
import { ArrowUpRight, Clock } from "lucide-react"

interface ProjectCardProps {
  project: Project
}

const TEMPLATE_META: Record<string, { bg: string; glow: string; dot: string; text: string }> = {
  REACT: { bg: "rgba(97,218,251,0.08)", glow: "rgba(97,218,251,0.18)", dot: "#61DAFB", text: "#61DAFB" },
  NEXTJS: { bg: "rgba(240,240,240,0.06)", glow: "rgba(240,240,240,0.14)", dot: "#e0e0e0", text: "#c8c8c8" },
  EXPRESS: { bg: "rgba(104,160,99,0.08)", glow: "rgba(104,160,99,0.2)", dot: "#68A063", text: "#68A063" },
  ANGULAR: { bg: "rgba(221,0,49,0.08)", glow: "rgba(221,0,49,0.2)", dot: "#DD0031", text: "#DD0031" },
  VUE: { bg: "rgba(65,184,131,0.08)", glow: "rgba(65,184,131,0.2)", dot: "#41B883", text: "#41B883" },
}

const getTemplateIcon = (template: string) => {
  switch (template.toUpperCase()) {
    case "REACT": return "/react-icon.png"
    case "NEXTJS": return "/nextjs-icon.png"
    case "EXPRESS": return "/express-icon.png"
    default: return "/placeholder.svg"
  }
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const createdAtFormatted = formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })
  const tmpl = project.template.toUpperCase()
  const t = TEMPLATE_META[tmpl] ?? { bg: "rgba(233,63,63,0.08)", glow: "rgba(233,63,63,0.2)", dot: "#E93F3F", text: "#E93F3F" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .pc2-card {
          position: relative;
          background: #0e0e10;
          border: 1px solid rgba(255,255,255,0.065);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.25s ease;
          font-family: 'Syne', sans-serif;
          isolation: isolate;
        }

        .pc2-card:hover {
          transform: translateY(-3px) scale(1.005);
          border-color: rgba(255,255,255,0.13);
          box-shadow:
            0 0 0 1px rgba(233,63,63,0.09),
            0 24px 60px rgba(0,0,0,0.55),
            0 8px 20px rgba(0,0,0,0.3);
        }

        .pc2-card:hover .pc2-arrow { opacity: 1; transform: translate(0,0); }
        .pc2-card:hover .pc2-title { color: #ffffff; }
        .pc2-card:hover .pc2-icon-glow { opacity: 0.9; transform: scale(1.2); }
        .pc2-card:hover .pc2-bottom-bar { opacity: 1; }
        .pc2-card:hover .pc2-icon-wrap { border-color: rgba(255,255,255,0.16); }
        .pc2-card:hover .pc2-username { color: rgba(255,255,255,0.65); }
        .pc2-card:hover .pc2-time { color: rgba(255,255,255,0.3); }
        .pc2-card:hover .pc2-shimmer { opacity: 1; animation: pc2-sweep 1s ease forwards; }
        .pc2-card:hover .pc2-avatar-ring::before { opacity: 1; }

        /* Ambient top band */
        .pc2-header-band {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 90px;
          pointer-events: none;
          z-index: 0;
        }

        /* Glow orb */
        .pc2-icon-glow {
          position: absolute;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          filter: blur(30px);
          opacity: 0.45;
          top: -10px;
          left: 0px;
          transition: opacity 0.35s ease, transform 0.35s ease;
          pointer-events: none;
          z-index: 1;
        }

        /* Light shimmer sweep */
        .pc2-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            108deg,
            transparent 30%,
            rgba(255,255,255,0.022) 50%,
            transparent 70%
          );
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
          z-index: 1;
        }

        @keyframes pc2-sweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Bottom colored line */
        .pc2-bottom-bar {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1.5px;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 5;
        }

        /* Main content area */
        .pc2-content {
          position: relative;
          z-index: 2;
          padding: 22px 22px 16px;
        }

        /* Top row */
        .pc2-toprow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .pc2-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          position: relative;
          z-index: 3;
          transition: border-color 0.22s;
        }

        .pc2-arrow {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translate(-5px, 5px);
          transition: all 0.24s cubic-bezier(0.34,1.56,0.64,1);
          color: #E93F3F;
          flex-shrink: 0;
        }

        .pc2-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.03em;
          color: #dcdcdc;
          margin: 0 0 10px;
          transition: color 0.2s;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pc2-badgerow {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .pc2-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 100px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.2s;
        }

        .pc2-card:hover .pc2-badge-primary { border-color: rgba(255,255,255,0.13); }

        .pc2-desc {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.27);
          line-height: 1.75;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: 0.01em;
        }

        /* Footer */
        .pc2-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 22px 15px;
          border-top: 1px solid rgba(255,255,255,0.048);
          position: relative;
          z-index: 2;
        }

        .pc2-user {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .pc2-avatar-ring {
          position: relative;
          flex-shrink: 0;
        }

        .pc2-avatar-ring::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(233,63,63,0.6), rgba(233,63,63,0.0) 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
        }

        .pc2-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.1);
          object-fit: cover;
          display: block;
          position: relative;
          z-index: 1;
        }

        .pc2-username {
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.38);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
          transition: color 0.2s;
        }

        .pc2-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.18);
          flex-shrink: 0;
          transition: color 0.2s;
          letter-spacing: 0.01em;
        }
      `}</style>

      <div className="pc2-card">

        {/* Ambient top band */}
        <div className="pc2-header-band"
          style={{ background: `linear-gradient(180deg, ${t.bg} 0%, transparent 100%)` }}
        />

        {/* Glow orb */}
        <div className="pc2-icon-glow" style={{ background: t.glow }} />

        {/* Shimmer sweep */}
        <div className="pc2-shimmer" />

        {/* Bottom color bar */}
        <div className="pc2-bottom-bar"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${t.dot} 50%, transparent 100%)` }}
        />

        {/* Main content */}
        <div className="pc2-content">

          <div className="pc2-toprow">
            <div className="pc2-icon-wrap" style={{ background: t.bg }}>
              <Image
                src={getTemplateIcon(project.template)}
                alt={project.template}
                width={26}
                height={26}
                className="object-contain"
              />
            </div>
            <div className="pc2-arrow">
              <ArrowUpRight size={13} />
            </div>
          </div>

          <h3 className="pc2-title">{project.title}</h3>

          <div className="pc2-badgerow">
            <span className="pc2-badge pc2-badge-primary" style={{ background: t.bg, color: t.text }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: t.dot, display: "inline-block", flexShrink: 0,
                boxShadow: `0 0 6px ${t.dot}`,
              }} />
              {project.template}
            </span>
            <span className="pc2-badge" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.18)" }}>
              #{project.id.substring(0, 6)}
            </span>
          </div>

          {project.description && (
            <p className="pc2-desc">{project.description}</p>
          )}

        </div>

        {/* Footer */}
        <div className="pc2-footer">
          <div className="pc2-user">
            <div className="pc2-avatar-ring">
              <Image
                src={project.user.image || "/placeholder.svg"}
                alt={project.user.name || "User"}
                width={28}
                height={28}
                className="pc2-avatar"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="pc2-username">{project.user.name || "Unknown"}</span>
          </div>
          <div className="pc2-time">
            <Clock size={9} />
            <span>{createdAtFormatted}</span>
          </div>
        </div>

      </div>
    </>
  )
}