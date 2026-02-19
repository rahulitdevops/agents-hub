# MODEL-GUIDE.md - Which Model to Use

Quick reference for choosing between Claude Sonnet 4.5 (default) and Llama 3.2 (local/free).

---

## 🌱 Use Llama 3.2 (Ollama - Free, Local)

**Best for simple tasks that don't need tools:**

### Text & Conversation
- Casual chat, jokes, storytelling
- Simple explanations ("What is X?")
- Basic proofreading/grammar checks
- Generate simple text (emails, messages)

### Knowledge & Facts
- Basic facts ("What's the capital of France?")
- Simple historical dates/events
- Common knowledge questions
- Dictionary definitions

### Math & Logic
- Basic arithmetic (2+2, percentages)
- Simple conversions (currency, units)
- Straightforward logic puzzles

### Creative
- Brainstorming ideas
- Random suggestions
- Simple creative writing

**Limitations:**
- ❌ No tool access (can't read files, search web, run commands)
- ❌ Less accurate on complex reasoning
- ❌ Shorter context window
- ❌ May struggle with multi-step tasks

---

## 🧠 Use Claude Sonnet 4.5 (Default - Paid, Smart)

**Best for anything complex or requiring tools:**

### Code & Technical
- Writing/debugging code
- Complex regex patterns
- System commands (exec)
- Git operations
- File editing/refactoring

### Research & Analysis
- Web searches
- Fetching/analyzing URLs
- Comparing options
- Deep research
- Data analysis

### Workspace Operations
- Reading/writing/editing files
- Memory searches
- Organizing documents
- Project management
- Config changes

### Complex Reasoning
- Multi-step problem solving
- Strategic planning
- Detailed explanations
- Decision making with multiple factors
- Anything requiring nuance

### Important Work
- Anything where accuracy matters
- Professional communications
- Financial calculations
- Security-related tasks
- Legal/medical questions

**Cost:**
- Input: $3 per 1M tokens (~$0.003 per 1k tokens)
- Output: $15 per 1M tokens (~$0.015 per 1k tokens)
- Most conversations cost $0.001-$0.01

---

## 🎯 Rule of Thumb

**Ask yourself:**
1. **Does it need files/web/tools?** → Sonnet
2. **Is accuracy critical?** → Sonnet
3. **Is it a multi-step complex task?** → Sonnet
4. **Is it just casual/simple?** → Llama is fine
5. **When in doubt?** → Sonnet (it's cheap anyway)

---

## 🔄 How to Switch

**To Llama 3.2:**
- "Use Ollama for this"
- "Switch to Llama"

**Back to Sonnet:**
- "Switch back to Sonnet"
- "Use Claude"

---

## 💡 Pro Tip

For most tasks, Sonnet is worth the tiny cost (~$0.01 per conversation). Only switch to Llama for truly simple stuff or when experimenting/learning.
