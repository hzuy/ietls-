export default function TypeHeader({ type, from, to }) {
  const base = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm'
  const q = `Questions ${from}–${to}`
  const headers = {
    true_false_ng: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-2">{q}</p>
        <p className="text-gray-700 mb-2">Do the following statements agree with the information given in this passage?</p>
        <p className="text-gray-600 mb-1">In the boxes below, write</p>
        <div className="space-y-1 text-gray-700">
          <p><strong>TRUE</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement agrees with the information</p>
          <p><strong>FALSE</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement contradicts the information</p>
          <p><strong>NOT GIVEN</strong>&nbsp;&nbsp;if it is impossible to say what the writer thinks about this</p>
        </div>
      </div>
    ),
    yes_no_ng: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-2">{q}</p>
        <p className="text-gray-700 mb-2">Do the following statements agree with the claims of the writer in the passage?</p>
        <p className="text-gray-600 mb-1">In the boxes below, write</p>
        <div className="space-y-1 text-gray-700">
          <p><strong>YES</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement agrees with the claims of the writer</p>
          <p><strong>NO</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if the statement contradicts the claims of the writer</p>
          <p><strong>NOT GIVEN</strong>&nbsp;&nbsp;if it is impossible to say what the writer thinks about this</p>
        </div>
      </div>
    ),
    mcq: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.</p>
      </div>
    ),
    mcq_multi: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>
      </div>
    ),
    fill_blank: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Complete the sentences below.</p>
        <p className="text-gray-600 mt-1">Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> from the passage for each answer.</p>
      </div>
    ),
    matching_headings: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">The passage has several paragraphs. Choose the correct heading for each paragraph from the list of headings below.</p>
        <p className="text-gray-600 mt-1">Write the correct number <strong>i–x</strong> in the boxes below.</p>
      </div>
    ),
    matching_features: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Match each statement with the correct person/place/feature <strong>A–F</strong> listed below.</p>
        <p className="text-gray-600 mt-1">You may use any letter more than once.</p>
      </div>
    ),
    matching_paragraph: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">The passage has several paragraphs. Which paragraph contains the following information?</p>
        <p className="text-gray-600 mt-1">Write the correct letter <strong>A–F</strong> in the boxes below.</p>
      </div>
    ),
    matching_endings: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Complete each sentence with the correct ending <strong>A–F</strong> from the box below.</p>
      </div>
    ),
    choose_title: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Choose the most suitable heading/title for this section from the list below.</p>
      </div>
    ),
    matching: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Match each statement with the correct information.</p>
        <p className="text-gray-600 mt-1">Write the correct letter in the boxes below.</p>
      </div>
    ),
    diagram_completion: (
      <div className={base}>
        <p className="font-bold text-gray-800 mb-1">{q}</p>
        <p className="text-gray-700">Label the diagram below.</p>
        <p className="text-gray-600 mt-1">Write <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>
      </div>
    ),
  }
  return headers[type] || (
    <div className={base}>
      <p className="font-bold text-gray-800 mb-1">{q}</p>
    </div>
  )
}
