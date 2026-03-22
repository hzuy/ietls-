const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const readingExam = await prisma.exam.create({
    data: {
      title: 'The History of Coffee',
      skill: 'reading',
      level: 'intermediate',
      content: `Coffee is one of the world's most popular beverages. 
Its history dates back to the 15th century in Yemen, where Sufi monks 
used coffee to stay awake during nightly prayers. From Yemen, coffee 
spread to the rest of the Middle East, Persia, Turkey, and North Africa.

The first coffeehouse opened in Constantinople in 1554. These establishments 
became centers of social activity and communication. By the 17th century, 
coffee had made its way to Europe. Initially, some controversy surrounded 
the drink, but it quickly became popular.

Today, Brazil is the world's largest coffee producer, followed by Vietnam 
and Colombia. Coffee contains caffeine, which stimulates the central 
nervous system and temporarily wards off drowsiness.`,
      questions: {
        create: [
          {
            questionText: 'Where did coffee originate?',
            type: 'mcq',
            options: JSON.stringify(['Brazil', 'Yemen', 'Turkey', 'Colombia']),
            correctAnswer: 'Yemen'
          },
          {
            questionText: 'In which century did coffee spread to Europe?',
            type: 'mcq',
            options: JSON.stringify(['15th century', '16th century', '17th century', '18th century']),
            correctAnswer: '17th century'
          },
          {
            questionText: 'Where was the first coffeehouse opened?',
            type: 'mcq',
            options: JSON.stringify(['Yemen', 'Persia', 'Constantinople', 'Brazil']),
            correctAnswer: 'Constantinople'
          },
          {
            questionText: "Which country is the world's largest coffee producer?",
            type: 'mcq',
            options: JSON.stringify(['Vietnam', 'Colombia', 'Yemen', 'Brazil']),
            correctAnswer: 'Brazil'
          },
          {
            questionText: 'What substance in coffee stimulates the central nervous system?',
            type: 'mcq',
            options: JSON.stringify(['Glucose', 'Caffeine', 'Protein', 'Tannin']),
            correctAnswer: 'Caffeine'
          }
        ]
      }
    }
  })
  console.log('Đã tạo đề Reading mẫu:', readingExam.title)

  const listeningExam = await prisma.exam.create({
    data: {
      title: 'Daily Conversations — At the Library',
      skill: 'listening',
      level: 'beginner',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      content: 'Listen to a conversation between a student and a librarian.',
      questions: {
        create: [
          {
            questionText: 'What does the student want to borrow?',
            type: 'mcq',
            options: JSON.stringify(['A novel', 'A textbook', 'A magazine', 'A dictionary']),
            correctAnswer: 'A textbook'
          },
          {
            questionText: 'How long can the student keep the book?',
            type: 'mcq',
            options: JSON.stringify(['1 week', '2 weeks', '3 weeks', '1 month']),
            correctAnswer: '2 weeks'
          },
          {
            questionText: 'What does the student need to show?',
            type: 'mcq',
            options: JSON.stringify(['Passport', 'Student ID', 'Credit card', 'Phone number']),
            correctAnswer: 'Student ID'
          },
          {
            questionText: 'What floor is the science section on?',
            type: 'mcq',
            options: JSON.stringify(['First floor', 'Second floor', 'Third floor', 'Fourth floor']),
            correctAnswer: 'Third floor'
          },
        ]
      }
    }
  })
  console.log('Đã tạo đề Listening mẫu:', listeningExam.title)

  const writingExam = await prisma.exam.create({
    data: {
      title: 'Task 2 — Technology and Society',
      skill: 'writing',
      level: 'intermediate',
      content: 'Some people think that technology has made our lives more complex. To what extent do you agree or disagree? Give your opinion and include relevant examples.',
    }
  })
  console.log('Đã tạo đề Writing mẫu:', writingExam.title)

  const speakingExam = await prisma.exam.create({
    data: {
      title: 'Part 2 — Describe a place',
      skill: 'speaking',
      level: 'intermediate',
      content: 'Describe a place you have visited that you particularly liked. You should say: where it is, when you went there, what you did there, and explain why you liked it so much.',
    }
  })
  console.log('Đã tạo đề Speaking mẫu:', speakingExam.title)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())