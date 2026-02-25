import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// GET /api/chat/history?playgroundId=xxx — Load chat history
export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const playgroundId = searchParams.get("playgroundId")

        const messages = await db.chatMessage.findMany({
            where: {
                userId: session.user.id,
                ...(playgroundId ? { playgroundId } : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 50, // Last 50 messages
        })

        return NextResponse.json({ messages })
    } catch (error) {
        console.error("Error loading chat history:", error)
        return NextResponse.json(
            { error: "Failed to load chat history" },
            { status: 500 }
        )
    }
}

// DELETE /api/chat/history?playgroundId=xxx — Clear chat history
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const playgroundId = searchParams.get("playgroundId")

        await db.chatMessage.deleteMany({
            where: {
                userId: session.user.id,
                ...(playgroundId ? { playgroundId } : {}),
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error clearing chat history:", error)
        return NextResponse.json(
            { error: "Failed to clear chat history" },
            { status: 500 }
        )
    }
}
