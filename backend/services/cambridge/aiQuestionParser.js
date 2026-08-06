const prisma = require('../../lib/prisma')
const { getGroqClient } = require('../../lib/groqClient')
const { cleanJsonRaw, repairTruncatedJson } = require('./jsonSanitizer')

// Phase 1: Analyze PDF structure using Groq AI
async function analyzeBookStructure(pages, originalname) {
  const groq = getGroqClient()
  const totalPages = pages.length
  const tocSample = pages.slice(0, Math.min(40, totalPages))
    .map((p, i) => `=== PAGE ${i + 1} ===\n${p}`)
    .join('\n\n')
    .substring(0, 20000)

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.0,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing Cambridge IELTS book PDFs. A Cambridge IELTS Academic/General book contains 4 tests. Each test has 4 sections: Listening (questions + transcript at the back), Reading (3 passages), Writing (Task 1 + Task 2), Speaking (3 parts). The Answer Key is typically near the end of the book. Return ONLY valid JSON, no explanation.`
      },
      {
        role: 'user',
        content: `Analyze the structure of this Cambridge IELTS book PDF. Find the page ranges for each test's 4 skills and the answer key.

ORIGINAL FILENAME: ${originalname}

IMPORTANT: Page numbers in the PDF text usually appear as standalone numbers or in headers/footers. Tests are typically labeled "Test 1", "Test 2", etc. Reading passages have titles. Listening sections say "SECTION 1", "SECTION 2", etc. The Answer Key section shows answers like "1. B  2. TRUE  3. carbon".

PDF CONTENT (first ${Math.min(40, totalPages)} pages):
${tocSample}

Total pages in PDF: ${totalPages}

Return this exact JSON structure (use 0 for unknown page numbers):
{
  "bookTitle": "Cambridge IELTS 19 Academic",
  "totalPages": ${totalPages},
  "tests": [
    {
      "testNumber": 1,
      "listening": { "startPage": 10, "endPage": 22 },
      "reading": { "startPage": 23, "endPage": 48 },
      "writing": { "startPage": 49, "endPage": 53 },
      "speaking": { "startPage": 54, "endPage": 57 }
    },
    {
      "testNumber": 2,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    },
    {
      "testNumber": 3,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    },
    {
      "testNumber": 4,
      "listening": { "startPage": 0, "endPage": 0 },
      "reading": { "startPage": 0, "endPage": 0 },
      "writing": { "startPage": 0, "endPage": 0 },
      "speaking": { "startPage": 0, "endPage": 0 }
    }
  ],
  "answerKey": { "startPage": 180, "endPage": 200 }
}`
      }
    ]
  })

  let structure
  try {
    const raw = cleanJsonRaw(completion.choices[0].message.content)
    structure = JSON.parse(raw)
  } catch {
    // Fallback: estimate page ranges for a ~200-page book
    const perTest = Math.floor(totalPages / 5)
    structure = {
      bookTitle: 'Cambridge IELTS',
      totalPages,
      tests: [1, 2, 3, 4].map(n => ({
        testNumber: n,
        listening:  { startPage: (n - 1) * perTest + 1,      endPage: (n - 1) * perTest + 12 },
        reading:    { startPage: (n - 1) * perTest + 13,     endPage: (n - 1) * perTest + 38 },
        writing:    { startPage: (n - 1) * perTest + 39,     endPage: (n - 1) * perTest + 43 },
        speaking:   { startPage: (n - 1) * perTest + 44,     endPage: (n - 1) * perTest + perTest }
      })),
      answerKey: { startPage: totalPages - 25, endPage: totalPages - 5 }
    }
  }

  // If AI couldn't detect book title, use the original filename
  if (!structure.bookTitle || structure.bookTitle === 'Unknown' || structure.bookTitle === 'Cambridge IELTS') {
    const cleanName = originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
    structure.bookTitle = cleanName
  }

  return structure
}

// Phase 2: Preview extraction using Groq AI
async function extractTestContent({ skill, testNumber, sectionText, answerText, bookTitle }) {
  const groq = getGroqClient()
  const title = `${bookTitle} - Test ${testNumber} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`
  let prompt = ''

  if (skill === 'reading') {
    prompt = `You are extracting IELTS Reading Test ${testNumber} from a Cambridge IELTS book PDF.

The text below is extracted from the PDF pages. It may have formatting artifacts. Extract ALL 3 passages and ALL 40 questions with their correct answers.

READING SECTION TEXT:
${sectionText.substring(0, 40000)}

${answerText ? `ANSWER KEY TEXT:\n${answerText}` : ''}

INSTRUCTIONS:
- Extract exactly 3 passages (Passage 1, Passage 2, Passage 3)
- Each passage has a title and body text (copy the full passage body)
- Questions are numbered 1–40 total (Passage 1: Q1–13, Passage 2: Q14–26, Passage 3: Q27–40 — but actual ranges vary)
- For correct answers: use the Answer Key section if provided; otherwise infer from context
- Question types: true_false_ng, yes_no_ng, mcq, fill_blank, short_answer, matching_headings, matching_features, matching_paragraph, matching_endings, choose_title, diagram_completion
- For MCQ: options array like ["A. option text", "B. option text", "C. option text", "D. option text"]
- For TRUE/FALSE/NOT GIVEN: correctAnswer is "TRUE", "FALSE", or "NOT GIVEN"
- For YES/NO/NOT GIVEN: correctAnswer is "YES", "NO", or "NOT GIVEN"
- For fill_blank / short_answer: correctAnswer is the word(s) that fill the blank
- For matching_headings: questionText is e.g. "Paragraph A" and correctAnswer is the Roman numeral "i", "ii", "iii", etc.

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "passages": [
    {
      "number": 1,
      "title": "The exact passage title",
      "body": "Full passage text here...",
      "questions": [
        { "number": 1, "type": "true_false_ng", "questionText": "The statement text", "options": null, "correctAnswer": "TRUE" },
        { "number": 5, "type": "mcq", "questionText": "Which of the following...?", "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"], "correctAnswer": "A. First option" },
        { "number": 9, "type": "fill_blank", "questionText": "The process involves ___ and ___", "options": null, "correctAnswer": "heating / cooling" },
        { "number": 14, "type": "matching_headings", "questionText": "Paragraph B", "options": null, "correctAnswer": "iii" }
      ]
    },
    { "number": 2, "title": "...", "body": "...", "questions": [] },
    { "number": 3, "title": "...", "body": "...", "questions": [] }
  ]
}`

  } else if (skill === 'listening') {
    prompt = `You are extracting IELTS Listening Test ${testNumber} from a Cambridge IELTS book PDF.

The text contains the QUESTIONS (not the audio transcripts). Extract all 4 sections with their questions.

LISTENING SECTION TEXT:
${sectionText.substring(0, 30000)}

${answerText ? `ANSWER KEY TEXT:\n${answerText}` : ''}

INSTRUCTIONS:
- There are 4 sections (SECTION 1, SECTION 2, SECTION 3, SECTION 4)
- Total 40 questions: Section 1 Q1–10, Section 2 Q11–20, Section 3 Q21–30, Section 4 Q31–40
- Write a 1-2 sentence context description for each section (what the audio is about)
- Question types: fill_blank, mcq, mcq_multi, short_answer, matching, map_diagram
- For fill_blank: questionText should include the blank as ___, e.g. "The venue is at ___ Street"
- For MCQ: include options like ["A. option", "B. option", "C. option"]
- Correct answers come from the Answer Key; if not available, leave as empty string ""

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "sections": [
    {
      "number": 1,
      "context": "A conversation between two students about enrolling in a course at a local college.",
      "questions": [
        { "number": 1, "type": "fill_blank", "questionText": "Name: ___ Johnson", "options": null, "correctAnswer": "Sarah" },
        { "number": 3, "type": "mcq", "questionText": "What type of course does the student want?", "options": ["A. Part-time", "B. Full-time", "C. Online", "D. Evening"], "correctAnswer": "A. Part-time" }
      ]
    },
    { "number": 2, "context": "...", "questions": [] },
    { "number": 3, "context": "...", "questions": [] },
    { "number": 4, "context": "...", "questions": [] }
  ]
}`

  } else if (skill === 'writing') {
    prompt = `You are extracting IELTS Writing Test ${testNumber} from a Cambridge IELTS book PDF.

WRITING SECTION TEXT:
${sectionText.substring(0, 8000)}

INSTRUCTIONS:
- Task 1: usually describes a chart, graph, map, process diagram, or letter. Copy the full prompt/instruction.
- Task 2: an essay question. Copy the full question text.
- taskType for Task 1: "chart" (bar/line/pie chart, table), "map" (map comparison), "process" (process diagram), "diagram" (other diagram), "letter" (informal/formal letter for GT)

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "task1": {
    "taskType": "chart",
    "prompt": "The graph below shows... Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."
  },
  "task2": {
    "prompt": "Some people think... To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."
  }
}`

  } else if (skill === 'speaking') {
    prompt = `You are extracting IELTS Speaking Test ${testNumber} from a Cambridge IELTS book PDF.

SPEAKING SECTION TEXT:
${sectionText.substring(0, 8000)}

INSTRUCTIONS:
- Part 1: 3-5 questions on familiar topics (home, work, hobbies, etc.)
- Part 2: a cue card topic with bullet points + follow-up questions
- Part 3: 4-6 discussion questions related to Part 2 topic

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "${title}",
  "part1": {
    "description": "The examiner asks general questions about familiar topics.",
    "questions": ["Do you work or study?", "What do you like about your hometown?", "How do you usually spend your weekends?"]
  },
  "part2": {
    "instructions": "You will have to talk about the topic for one to two minutes. You have one minute to think about what you are going to say. You can make some notes to help you if you wish.",
    "cueCard": "Describe a place you have visited that you particularly liked.\n\nYou should say:\n  where it is\n  when you went there\n  what you did there\nand explain why you liked it so much.",
    "questions": ["Would you like to go back?", "Do you think tourism has changed this place?"]
  },
  "part3": {
    "description": "Discussion topics related to travel and places.",
    "topics": [
      {
        "label": "Tourism",
        "questions": ["Why do people enjoy travelling to different countries?", "How has tourism changed in recent years?"]
      },
      {
        "label": "Local culture",
        "questions": ["How important is it to preserve local culture?", "Can tourism help preserve culture or does it damage it?"]
      }
    ]
  }
}`
  }

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.0,
    max_tokens: skill === 'reading' ? 16000 : 8000,
    messages: [
      {
        role: 'system',
        content: 'You are an expert IELTS content extractor. Extract exam content from Cambridge IELTS PDF text accurately. The PDF text may have minor formatting artifacts — interpret them correctly. Return ONLY valid JSON with no markdown code blocks.'
      },
      { role: 'user', content: prompt }
    ]
  })

  const raw = cleanJsonRaw(completion.choices[0].message.content)
  const extracted = JSON.parse(raw)

  return { raw, extracted }
}

// Extraction for save to DB (Phase 3 - extract-save)
async function extractTestContentForSave({ skill, bookNumber, testNumber, contentText, answerText, seriesId, s, e }) {
  let seriesName = 'IELTS'
  if (seriesId) {
    try {
      const sr = await prisma.examSeries.findUnique({ where: { id: parseInt(seriesId) } })
      if (sr) seriesName = sr.name
    } catch {}
  }
  const bookLabel = bookNumber ? `${seriesName} ${bookNumber}` : seriesName
  const title = `${bookLabel} - Test ${testNumber} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`

  const PROMPTS = {
    reading: `Extract IELTS Reading Test ${testNumber} from the PDF text. Return ONLY valid JSON, no markdown, no explanation.

READING TEXT (pages ${s}–${e}):
${contentText.substring(0, 35000)}
${answerText ? `\nANSWER KEY (use for correctAnswer):\n${answerText}` : ''}

Rules:
- 3 passages. "body" = full passage text verbatim (essential for students to read).
- question types: mcq|mcq_multi|true_false_ng|yes_no_ng|fill_blank|short_answer|matching_headings|matching_features|matching_paragraph|matching_endings|choose_title|diagram_completion
- mcq/mcq_multi: options=["A. text","B. text",...], correctAnswer=exact matching option string
- true_false_ng/yes_no_ng: correctAnswer="TRUE"/"FALSE"/"NOT GIVEN" or "YES"/"NO"/"NOT GIVEN"
- matching_headings: options=["i. heading",...], correctAnswer=roman numeral string
- fill_blank/short_answer: options=null, correctAnswer=word(s) to fill
- imageUrl=null for all questions

{"title":"${title}","passages":[{"number":1,"title":"Passage title","body":"Full passage text here...","questions":[{"number":1,"type":"mcq","questionText":"Question?","options":["A. opt","B. opt","C. opt","D. opt"],"correctAnswer":"A. opt","imageUrl":null}]}]}`,

    listening: `Extract IELTS Listening Test ${testNumber} from the PDF text below. Return ONLY valid JSON matching this exact schema.

LISTENING TEXT (pages ${s}–${e}):
${contentText.substring(0, 30000)}
${answerText ? `\nANSWER KEY:\n${answerText}` : ''}

Rules:
- 4 sections (SECTION 1–4), questions 1–40
- Question types: fill_blank|mcq|mcq_multi|short_answer|matching|map_diagram
- fill_blank: blank shown as ___ in questionText, correctAnswer = missing word(s)
- mcq: options ["A. text","B. text","C. text"], correctAnswer = exact option text
- mcq_multi (choose TWO): correctAnswer = "A. text,C. text"
- map_diagram: options = ["A","B","C",...], correctAnswer = correct letter
- Use answer key for correctAnswer

{"title":"${title}","sections":[{"number":1,"context":"Brief description of the conversation/talk","transcript":"","questions":[{"number":1,"type":"fill_blank","questionText":"Name: ___ Johnson","options":null,"correctAnswer":"Sarah","imageUrl":null}]}]}`,

    writing: `Extract IELTS Writing Test ${testNumber} from the PDF text below. Return ONLY valid JSON.

WRITING TEXT (pages ${s}–${e}):
${contentText.substring(0, 8000)}

{"title":"${title}","task1":{"taskType":"chart","prompt":"Full Task 1 prompt including instructions..."},"task2":{"prompt":"Full Task 2 essay question including instructions..."}}

taskType options: chart | map | process | diagram | letter`,

    speaking: `Extract IELTS Speaking Test ${testNumber} from the PDF text below. Return ONLY valid JSON.

SPEAKING TEXT (pages ${s}–${e}):
${contentText.substring(0, 8000)}

{"title":"${title}","part1":{"description":"Examiner asks about familiar topics.","questions":["Q1?","Q2?","Q3?"]},"part2":{"instructions":"You will have to talk for 1–2 minutes...","cueCard":"Describe ...\\n\\nYou should say:\\n  ...\\nand explain ...","questions":["Follow-up Q?"]},"part3":{"description":"Discussion topics related to ...","topics":[{"label":"Topic A","questions":["Q1?","Q2?"]},{"label":"Topic B","questions":["Q3?"]}]}}`
  }

  const prompt = PROMPTS[skill]
  if (!prompt) throw new Error('Skill không hợp lệ')

  const groq = getGroqClient()
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.0,
    max_tokens: skill === 'reading' ? 16000 : 6000,
    messages: [
      { role: 'system', content: 'You are an expert IELTS content extractor. Extract exam content from Cambridge IELTS PDF text accurately. Return ONLY valid JSON with no markdown code blocks, no explanation.' },
      { role: 'user', content: prompt }
    ]
  })

  const finishReason = completion.choices[0].finish_reason
  let raw = (completion.choices[0].message.content || '').trim()

  raw = repairTruncatedJson(raw, finishReason)
  const extracted = JSON.parse(raw)

  return { finishReason, raw, extracted, title }
}

module.exports = {
  analyzeBookStructure,
  extractTestContent,
  extractTestContentForSave
}
