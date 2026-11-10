import {describe,it,expect} from 'vitest'
const {sameSubmissionAnswers}=require('./submissionIdentity')
describe('submission payload identity (TC-042)',()=>{
  it('replays the same answers regardless of property ordering',()=>{
    expect(sameSubmissionAnswers('{"2":"blue","1":"A,B"}',{1:'A,B',2:'blue'})).toBe(true)
  })
  it('rejects changes, additions and omissions rather than mixing an old score with new results',()=>{
    expect(sameSubmissionAnswers('{"1":"blue"}',{1:'red'})).toBe(false)
    expect(sameSubmissionAnswers('{"1":"blue"}',{1:'blue',2:'red'})).toBe(false)
    expect(sameSubmissionAnswers('{"1":"blue"}',{})).toBe(false)
  })
  it('does not treat corrupt or absent stored snapshots as a replay',()=>{
    for(const value of [null,undefined,'invalid','[]','null'])expect(sameSubmissionAnswers(value,{})).toBe(false)
  })
})
