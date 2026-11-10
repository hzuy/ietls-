import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import QuestionBlock from './QuestionBlock'
import {QuestionBlock as ListeningQuestionBlock} from './listening/OtherGroups'
describe('legacy and grouped text-answer renderer (TC-041)',()=>{
  it('renders the supported Listening short_answer type too',()=>{
    render(<ListeningQuestionBlock q={{id:8,number:1,type:'short_answer',questionText:'What colour?'}} globalIdx={0} answers={{8:'blue'}} onAnswer={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('blue')
  })
  it.each(['short_answer','fill_blank','diagram_completion'])('renders %s with a usable answer field',type=>{
    const onAnswer=vi.fn()
    render(<QuestionBlock q={{id:7,number:1,type,questionText:'What colour?',options:null}} answers={{7:'blue'}} onAnswer={onAnswer} />)
    const field=screen.getByRole('textbox')
    expect(field).toHaveValue('blue')
    fireEvent.change(field,{target:{value:'red'}})
    expect(onAnswer).toHaveBeenCalledWith(7,'red')
  })
})
