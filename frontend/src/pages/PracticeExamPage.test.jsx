import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PracticeExamPage from './PracticeExamPage'

const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),past:vi.fn(),persist:vi.fn(),clear:vi.fn(),mark:vi.fn(),check:vi.fn(()=>({hasDraft:false}))}))
vi.mock('../services/practiceService',()=>({getPractice:mocks.get,savePracticeAttempt:mocks.save,getPracticeAttempt:mocks.past}))
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:7}})}))
vi.mock('../hooks/usePracticeDraft',()=>({usePracticeDraft:()=>({checkDraftOnMount:mocks.check,persistDraftNow:mocks.persist,clearDraft:mocks.clear,markSaved:mocks.mark,lastSavedAt:null})}))
vi.mock('../hooks/useBrowserHistoryGuard',()=>({useBrowserHistoryGuard:()=>({showModal:false,stay:vi.fn(),leave:vi.fn()})}))
vi.mock('../hooks/useTextHighlight',()=>({useTextHighlight:()=>({scopeHighlights:[]})}))
vi.mock('../components/Navbar',()=>({default:()=>null}))
vi.mock('../components/common/ReportIssueButton',()=>({default:()=>null}))
vi.mock('../pages/ExamReview',()=>({default:({practice})=><div data-testid="review">{practice.result.sections[0].questions[0].correctAnswer}</div>}))
vi.mock('../components/practice/ReadingPracticeGroupBlock',()=>({default:({answers,onAnswer})=><input aria-label="Answer" value={answers[1]||''} onChange={e=>onAnswer(1,e.target.value)}/>}))
vi.mock('../components/practice/ListeningPracticeGroupBlock',()=>({default:({answers,onAnswer})=><input aria-label="Answer" value={answers[1]||''} onChange={e=>onAnswer(1,e.target.value)}/>}))
const exam={id:16,title:'Practice fixture',questions:{groups:[{type:'note_completion',qNumberStart:1,qNumberEnd:1,questions:[{number:1}]}]}}
const saved={correct:1,total:1,reviewExam:{...exam,questions:{groups:[{type:'note_completion',qNumberStart:1,qNumberEnd:1,questions:[{number:1,correctAnswer:'blue'}]}]}},result:{sections:[{questions:[{number:1,status:'correct',correctAnswer:'blue'}]}]}}
function mount(skill){render(<MemoryRouter initialEntries={['/practice/'+skill+'/16']}><Routes><Route path="/practice/:skill/:id" element={<PracticeExamPage skill={skill}/>}/></Routes></MemoryRouter>)}
async function submit(){fireEvent.click(await screen.findByRole('button',{name:'Nộp bài',exact:true}));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Nộp bài',exact:true}))}
describe.each(['reading','listening'])('%s practice server grading',skill=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.get.mockResolvedValue(exam);mocks.save.mockReset();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
 it('sends answers only, waits for ACK before clearing draft or showing server result',async()=>{
  let resolve;mocks.save.mockImplementation(()=>new Promise(r=>{resolve=r}));mount(skill)
  fireEvent.change(await screen.findByLabelText('Answer'),{target:{value:'blue'}});await submit()
  expect(mocks.save).toHaveBeenCalledWith(skill,16,{answers:{1:'blue'}})
  expect(mocks.clear).not.toHaveBeenCalled();expect(screen.queryByTestId('review')).toBeNull()
  resolve(saved);expect(await screen.findByTestId('review')).toHaveTextContent('blue');expect(mocks.clear).toHaveBeenCalledOnce()
 })
 it('preserves draft and answer when the server rejects submission, then allows retry',async()=>{
  mocks.save.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(saved);mount(skill)
  fireEvent.change(await screen.findByLabelText('Answer'),{target:{value:'blue'}});await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể lưu')
  expect(mocks.clear).not.toHaveBeenCalled();expect(screen.getByLabelText('Answer')).toHaveValue('blue')
  await submit();await waitFor(()=>expect(screen.getByTestId('review')).toBeInTheDocument())
 })
})
