# BotSmith - AI Chatbot Builder

Complete chatbot builder with multi-provider AI support (OpenAI, Claude, Gemini)

## 🚀 Quick Start (New Emergent Account)

```bash
bash /app/setup.sh
```

**That's it!** Installation takes 2-3 minutes. Access at http://localhost:3000

### Alternative: Use existing fast_start.sh
```bash
bash /app/fast_start.sh
```

This checks if dependencies are already installed and only installs if needed.

## ✨ Features

- Multi-Provider AI (GPT-4o Mini, Claude 3.5 Haiku, Gemini Flash Lite)
- File Uploads (PDF, DOCX, TXT, XLSX, CSV)
- Website Scraping
- RAG System with MongoDB (Text-based, no ChromaDB)
- Real-time Chat with Session Management
- Analytics Dashboard with Multiple Charts
- Integration Management (Slack, Telegram, Discord, WhatsApp, etc.)
- Public Access & Widget Embedding
- Mobile Responsive Design

## 📦 Tech Stack

- **Backend**: FastAPI + MongoDB + emergentintegrations
- **Frontend**: React 18.2.0 + Tailwind CSS + Recharts
- **AI**: OpenAI, Anthropic, Google Generative AI

## 🔧 Development

Services auto-reload on file changes. For dependency changes:
```bash
sudo supervisorctl restart all
```

Check service status:
```bash
sudo supervisorctl status
```

View logs:
```bash
tail -50 /var/log/supervisor/backend.err.log
tail -50 /var/log/supervisor/frontend.out.log
```

## 📄 Documentation

- API Docs: http://localhost:8001/docs
- Installation Guide: `/app/INSTALLATION_GUIDE.md`
- Setup Instructions: See `/app/test_result.md` (Quick Setup section)

## 🛠️ Troubleshooting

**Services not starting:**
```bash
sudo supervisorctl restart all
sleep 10
sudo supervisorctl status
```

**Port conflicts:**
- Backend: 8001
- Frontend: 3000
- MongoDB: 27017

---
Made with ❤️ | © 2025 BotSmith

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/sumeet6288/botsmith15012026?utm_source=oss&utm_medium=github&utm_campaign=sumeet6288%2Fbotsmith15012026&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
