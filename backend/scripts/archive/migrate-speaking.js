const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Basic regex to find questions or list items in HTML
function extractQuestions(html) {
  if (!html) return []
  // Matches <li>...</li> or <p>...?</p>
  const matches = html.match(/<li>(.*?)<\/li>|<p>(.*?\?)<\/p>/gi) || []
  return matches.map(m => m.replace(/<\/?[^>]+(>|$)/g, "").trim()).filter(t => t.length > 5)
}

async function migrateSpeakingSamples() {
  console.log('--- Migrating Speaking Samples ---')
  const samples = await prisma.speakingSample.findMany({
    where: { deletedAt: null },
    include: { parts: true }
  })

  for (const sample of samples) {
    if (sample.parts.length > 0) {
      console.log(`- Skipping sample ${sample.id} (already has parts)`)
      continue
    }

    try {
      const content = sample.content || ''
      
      // Simple heuristic: split content by "Part 1", "Part 2", "Part 3" headers
      // Since it's HTML, we look for <h2>Part X</h2> or similar
      const parts = []
      
      // Look for Part 1 content
      const p1Match = content.match(/Part 1(.*?)Part 2|Part 1(.*$)/si)
      if (p1Match) parts.push({ num: 1, html: p1Match[0] })
      
      const p2Match = content.match(/Part 2(.*?)Part 3|Part 2(.*$)/si)
      if (p2Match) parts.push({ num: 2, html: p2Match[0] })
      
      const p3Match = content.match(/Part 3(.*$)/si)
      if (p3Match) parts.push({ num: 3, html: p3Match[0] })

      if (parts.length === 0) {
        // Fallback: If no part markers found, create 1 generic part from whole content
        parts.push({ num: 1, html: content })
      }

      for (const p of parts) {
        const createdPart = await prisma.speakingSamplePart.create({
          data: {
            sampleId: sample.id,
            partNumber: p.num,
            title: `Part ${p.num}`
          }
        })

        const questions = extractQuestions(p.html)
        for (let i = 0; i < questions.length; i++) {
          await prisma.speakingSampleQuestion.create({
            data: {
              partId: createdPart.id,
              questionText: questions[i],
              orderNum: i
            }
          })
        }
      }

      console.log(`✓ Migrated SpeakingSample ID: ${sample.id} (${parts.length} parts created)`)
    } catch (e) {
      console.error(`✗ Failed to migrate SpeakingSample ID: ${sample.id}`, e.message)
    }
  }
}

async function main() {
  await migrateSpeakingSamples()
  console.log('\n--- Speaking Migration Finished ---')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
