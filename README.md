# 🧠 VibeCode Editor – AI-Powered Web IDE

**VibeCode Editor** is an intelligent, feature-rich web-based IDE built entirely in the browser using **Next.js 15**, **WebContainers**, **Monaco Editor**, and **AI integration via Ollama**. It enables real-time code execution, intelligent code suggestions, AI-powered assistance, and support for multiple technology stacks — all with a modern, developer-first interface.

---

## ✨ Key Features

### 🔐 **Authentication & User Management**
- OAuth login via Google and GitHub (powered by NextAuth 5)
- User roles: ADMIN, USER, PREMIUM_USER
- Secure account linking and session management

### 🎨 **Modern User Interface**
- Responsive design with TailwindCSS v4
- Beautiful component library from ShadCN UI
- Dark/Light mode toggle (powered by next-themes)
- Smooth animations and transitions

### 🏗️ **Project Management**
- Pre-built templates: React, Next.js, Express, Hono, Vue, and Angular
- Create, organize, and manage multiple playgrounds
- Star/bookmark favorite projects for quick access
- Real-time title and description editing

### 🖊️ **Advanced Code Editor**
- Monaco Editor with full syntax highlighting
- Support for multiple languages and frameworks
- Customizable keybindings and formatting
- Code completion and IntelliSense

### 💡 **AI-Powered Intelligence**
- Local LLM integration via Ollama for privacy-first code suggestions
- AI code completion with smart context awareness
- AI Chat Assistant to discuss, refactor, and explain code
- File attachment/sharing with AI for context-aware help

### 🌐 **In-Browser Code Execution**
- WebContainers runtime for safe, sandboxed code execution
- Run frontend and backend applications directly in the browser
- No server-side compilation needed
- Support for npm packages and dependencies

### 💻 **Integrated Terminal**
- Full-featured terminal with xterm.js
- Command-line tools and utilities support
- Interactive debugging capabilities
- Addon support: WebGL, search, and web links

### 📊 **Dashboard & Analytics**
- Personalized dashboard with quick access to recent projects
- Project statistics and metadata
- Navigation sidebar with organized shortcuts

---

## 🧱 Technology Stack

| Category      | Technology                                     |
|---------------|------------------------------------------------|
| **Framework** | Next.js 15 (App Router)                        |
| **Runtime**   | Node.js / React 19                             |
| **Language**  | TypeScript 5                                   |
| **Styling**   | TailwindCSS 4, ShadCN UI                       |
| **Auth**      | NextAuth 5 (Google + GitHub OAuth)             |
| **Editor**    | Monaco Editor v0.52                            |
| **Execution** | WebContainers API                              |
| **Terminal**  | xterm.js v5.5 with addons                      |
| **Database**  | MongoDB (via Prisma ORM)                       |
| **Chat**      | AI Chat with file context sharing              |
| **UI Library**| Radix UI components                            |
| **Forms**     | React Hook Form + Zod validation               |
| **State**     | Zustand for client state management            |
| **Markdown**  | React Markdown with KaTeX math support         |

---

## 📋 Project Structure

```
VibeCode/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Authentication pages
│   │   └── auth/
│   │       ├── layout.tsx
│   │       └── sign-in/
│   ├── (root)/                  # Public pages (home, landing)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/                     # API routes
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── chat/               # AI chat API with history
│   │   ├── code-suggestion/    # Code suggestion API
│   │   └── github/             # GitHub repos integration
│   ├── dashboard/              # Dashboard pages
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── playground/             # Code playground with dynamic IDs
│       └── [id]/
├── components/                  # Reusable UI components
│   ├── ui/                     # ShadCN UI components (50+ components)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sidebar.tsx
│   │   ├── chart.tsx
│   │   └── [more...]
│   ├── modal/                  # Custom modals
│   │   └── template-selector-modal.tsx
│   └── providers/              # React providers
│       └── theme-providers.tsx
├── features/                    # Feature modules (modular architecture)
│   ├── ai-chat/                # AI chat feature
│   │   ├── components/
│   │   │   ├── ai-chat-code-blocks.tsx
│   │   │   ├── ai-chat-sidepanel.tsx
│   │   │   └── file-preview.tsx
│   │   └── hooks/
│   ├── auth/                   # Authentication feature
│   │   ├── actions/
│   │   ├── components/
│   │   │   └── logout-button.tsx
│   │   ├── hooks/
│   │   └── types.ts
│   ├── dashboard/              # Dashboard feature
│   │   ├── dashboard-sidebar.tsx
│   │   ├── components/
│   │   └── types.ts
│   ├── home/                   # Home page components
│   │   ├── header.tsx
│   │   └── footer.tsx
│   ├── playground/             # Playground feature
│   │   ├── actions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── libs/
│   │   └── types/
│   └── webcontainers/          # WebContainers integration
│       ├── components/
│       ├── hooks/
│       ├── libs/
│       └── service/
├── hooks/                       # Custom React hooks
│   └── use-mobile.ts
├── lib/                         # Utility functions & helpers
│   ├── chat-models.ts          # AI model configuration
│   ├── db.ts                   # Database utilities
│   ├── syntax-highlighter.tsx  # Code highlighting
│   ├── template.ts             # Template utilities
│   └── utils.ts
├── prisma/                      # Database schema & migrations
│   └── schema.prisma           # MongoDB schema with models
├── public/                      # Static assets
│   ├── hero.svg
│   └── [images and icons]
├── auth.config.ts              # NextAuth configuration
├── auth.ts                      # Auth setup
├── middleware.ts               # Next.js middleware
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # TailwindCSS config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- MongoDB instance (local or MongoDB Atlas)
- Ollama installed (for AI suggestions)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/priteshdev8767/VibeCode.git
   cd VibeCode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   # NextAuth Configuration
   AUTH_SECRET=your_super_secret_key_generate_with_openssl

   # OAuth Providers
   AUTH_GOOGLE_ID=your_google_client_id
   AUTH_GOOGLE_SECRET=your_google_client_secret
   AUTH_GITHUB_ID=your_github_app_id
   AUTH_GITHUB_SECRET=your_github_app_secret

   # Database
   DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/vibecode

   # Application URL
   NEXTAUTH_URL=http://localhost:3000
   ```

   > Generate a secure AUTH_SECRET:
   > ```bash
   > openssl rand -base64 32
   > ```

4. **Set up the database**

   Run Prisma migrations to set up MongoDB:

   ```bash
   npx prisma db push
   ```

   Generate Prisma Client:

   ```bash
   npx prisma generate
   ```

5. **Start Ollama (optional, for code suggestions)**

   Ensure [Ollama](https://ollama.com/) is installed and running:

   ```bash
   ollama run codellama
   ```

   Or use another model like `mistral`, `neural-chat`, etc.

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` in your browser.

---

## 📦 Database Schema

The application uses MongoDB with the following models:

### **User**
- Authentication and profile management
- Supports roles: ADMIN, USER, PREMIUM_USER
- Links to OAuth accounts and playgrounds

### **Account**
- OAuth account linking
- Stores refresh tokens and provider info

### **Playground**
- Code projects/workspaces
- Associated with templates and files
- Trackable timestamps and ownership

### **TemplateFile**
- File structure for projects
- Stores template content as JSON

### **StarMark**
- Bookmarking/favoriting playgrounds
- User-specific marks

### **ChatMessage** (referenced in User model)
- AI chat conversation history
- Context for multi-turn conversations

---

## 🎨 UI Components

The project includes **50+ ShadCN UI components** including:
- Forms (inputs, buttons, checkboxes, radio groups)
- Dialogs, modals, drawers, popover, tooltips
- Navigation (sidebar, navigation menu, tabs)
- Data display (tables, cards, charts, accordions)
- Feedback (alerts, progress, loaders, sonner toasts)

See `components/ui/` for the complete list.

---

## 🔧 Key APIs & Routes

### **Authentication Routes**
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### **Chat Routes**
- `POST /api/chat` - Send message to AI
- `GET /api/chat/history` - Get chat history

### **Code Suggestions**
- `POST /api/code-suggestion` - Get AI code suggestions

### **GitHub Integration**
- `GET /api/github/repos` - Fetch user's GitHub repositories

### **Templates**
- `GET /api/template/[id]` - Get template files by ID

---

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Space` / `Double Enter` | Trigger AI code suggestions |
| `Tab` | Accept AI suggestion |
| `Ctrl + S` | Save file (if implemented) |
| `Ctrl + /` | Toggle comment |
| `Alt + Shift + F` | Format document |

---

## 📝 Development Workflow

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type check
tsc --noEmit
```

### Code Organization Best Practices

1. **Features-based Structure** - Each feature has its own folder with components, hooks, actions, and types
2. **Modular Design** - Independent features that can be developed separately
3. **TypeScript** - Full type safety across the codebase
4. **Component Hierarchy** - Reusable UI components in `components/ui/`
5. **Custom Hooks** - Business logic in custom hooks within feature folders

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Set environment variables in Vercel dashboard
4. Deploy with one click

```bash
vercel deploy
```

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform (Vercel, Railway, etc.)

---

## 🔐 Security Considerations

- **NextAuth** provides secure session management
- **WebContainers** sandbox executes in an isolated environment
- **MongoDB** with Prisma ORM prevents SQL injection
- **OAuth** delegates authentication to trusted providers
- **Environment variables** keep sensitive data secure

---

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
- Verify `DATABASE_URL` in `.env.local`
- Ensure MongoDB instance is running
- Check firewall/network access

**2. OAuth Login Fails**
- Verify OAuth credentials in environment variables
- Ensure redirect URIs match in OAuth provider settings
- Check `NEXTAUTH_URL` matches your application URL

**3. Ollama Not Found**
- Ensure Ollama is installed and running
- Check if model is downloaded: `ollama pull codellama`
- Verify Ollama is accessible on `http://localhost:11434`

**4. WebContainers Permission Error**
- Check if COOP/COEP headers are properly set (done in `next.config.ts`)
- Clear browser cache
- Try a different browser

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ✅ Roadmap

- [x] Google & GitHub OAuth authentication
- [x] Multiple project templates
- [x] Monaco Editor with syntax highlighting
- [x] WebContainers for code execution
- [x] AI chat for code assistance
- [x] Terminal integration with xterm.js
- [ ] GitHub repository import/export
- [ ] Real-time collaboration
- [ ] Plugin system for custom templates
- [ ] One-click deployment via Vercel/Netlify
- [ ] Code sharing links
- [ ] Version history & rollback
- [ ] Team workspaces

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- [Next.js](https://nextjs.org/) - React framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Ollama](https://ollama.com/) - Local LLM runtime
- [WebContainers](https://webcontainers.io/) - Browser-based runtime
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Prisma](https://www.prisma.io/) - ORM
- [ShadCN UI](https://ui.shadcn.com/) - UI component library
- [TailwindCSS](https://tailwindcss.com/) - CSS framework

---

## 📞 Support

For issues, feature requests, or questions:
- Open an [Issue](https://github.com/your-username/vibecode-editor/issues)
- Start a [Discussion](https://github.com/your-username/vibecode-editor/discussions)
- Email: support@vibecode.dev

---

**Built with ❤️ by the VibeCode team**
