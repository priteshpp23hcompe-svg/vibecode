import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get the GitHub access token from the Account table
        const account = await db.account.findFirst({
            where: {
                userId: session.user.id,
                provider: "github",
            },
            select: {
                accessToken: true,
            },
        });

        if (!account?.accessToken) {
            return NextResponse.json(
                { error: "GitHub account not linked or access token missing. Please re-sign in with GitHub." },
                { status: 403 }
            );
        }

        // Fetch repos from GitHub API
        const response = await fetch(
            "https://api.github.com/user/repos?sort=updated&per_page=50&type=all",
            {
                headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("GitHub API error:", response.status, errorText);
            return NextResponse.json(
                { error: `GitHub API error: ${response.status}` },
                { status: response.status }
            );
        }

        const repos = (await response.json()) as {
            id: number;
            name: string;
            full_name: string;
            description: string | null;
            private: boolean;
            default_branch: string;
            updated_at: string;
            language: string | null;
            stargazers_count: number;
            owner: { login: string; avatar_url: string };
        }[];

        // Return a simplified list
        const simplifiedRepos = repos.map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            private: repo.private,
            default_branch: repo.default_branch,
            updated_at: repo.updated_at,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            owner: {
                login: repo.owner.login,
                avatar_url: repo.owner.avatar_url,
            },
        }));

        return NextResponse.json({ repos: simplifiedRepos });
    } catch (error) {
        console.error("Error fetching GitHub repos:", error);
        return NextResponse.json(
            { error: "Failed to fetch repositories" },
            { status: 500 }
        );
    }
}
