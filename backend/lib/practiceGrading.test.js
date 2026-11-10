import { describe, it, expect } from 'vitest'
const { gradePractice } = require('./practiceGrading')
const groups=[{type:'note_completion',qNumberStart:1,qNumberEnd:2,questions:[{number:1,correctAnswer:'discs/disks'},{number:2,correctAnswer:'soil'}]},
  {type:'mcq_multi',qNumberStart:3,qNumberEnd:6,maxChoices:2,questions:[{number:3,correctAnswer:'Alpha,Beta',options:['Alpha','Beta','Gamma']},{number:5,correctAnswer:'One,Two',options:['One','Two','Three']}]}]
describe.each(['reading','listening'])('%s practice scoring',skill=>{
  it('preserves the complete comma-containing answer in scoring and review', () => {
    const options = ['First', 'Second', 'When his tomb was uncovered, a small number of his belongings still remained']
    const g = [{ type: 'mcq_multi', maxChoices: 2, qNumberStart: 25, qNumberEnd: 26, questions: [{ number: 25, options, correctAnswer: `${options[0]},${options[2]}` }] }]
    const result = gradePractice(skill, { title: 'Djoser' }, g, { 25: `${options[2]},${options[0]}` })
    expect(result.correct).toBe(2)
    expect(result.total).toBe(2)
    expect(result.result.sections[0].questions.map(q => q.userAnswer)).toContain(options[2])
  })
  it('counts two multi records as four distinct slots, plus singles',()=>{
    const r=gradePractice(skill,{title:'Fixture'},groups,{1:' disks ',2:'wrong',3:'Beta,Alpha,Alpha',5:'Two'})
    expect([r.correct,r.total]).toEqual([4,6])
    expect(r.result.sections[0].questions.map(q=>q.status)).toEqual(['correct','wrong','correct','correct','correct','missed'])
    expect(r.result.sections[0].questions[2].userAnswer).toBe('Beta')
    expect(r.result.sections[0].questions[3].correctAnswer).toBe('Alpha')
  })
  it('does not award blank answers or count forged/unknown question ids',()=>{
    expect(gradePractice(skill,{},groups,{}).correct).toBe(0)
    expect(()=>gradePractice(skill,{},groups,{999:'Alpha'})).toThrow()
  })
  it('rejects excess/invalid choices rather than clipping their score',()=>{
    expect(()=>gradePractice(skill,{},groups,{3:'Alpha,Beta,Gamma'})).toThrow()
    expect(()=>gradePractice(skill,{},groups,{3:'Unknown'})).toThrow()
  })
})
