// TODO(spell): Move the utility functions into Muya if there is no other way to replace the word.
import { offsetToWordCursor, validateLineCursor, SpellChecker } from '../../../renderer/spellchecker'
import selection from '../selection'

const coreApi = ContentState => {
  /**
   * Replace the word range with the given replacement.
   *
   * @param {*} line A line block reference of the line that contains the word to
   *                 replace - must be a valid reference!
   * @param {*} wordCursor The range of the word to replace (line: "abc >foo< abc"
   *                       whereas `>`/`<` is start and end of `wordCursor`). This
   *                       range is replaced by `replacement`.
   * @param {string} replacement The replacement.
   * @param {boolean} setCursor Whether the editor cursor should be updated.
   */
  ContentState.prototype.replaceWordInline = function (line, wordCursor, replacement, setCursor = false) {
    const { start: lineStart, end: lineEnd } = line
    const { start: wordStart, end: wordEnd } = wordCursor

    // Validate cursor ranges.
    if (wordStart.key !== wordEnd.key) {
      throw new Error('Expect a single line word cursor: "start.key" is not equal to "end.key".')
    } else if (lineStart.key !== lineEnd.key) {
      throw new Error('Expect a single line line cursor: "start.key" is not equal to "end.key".')
    } else if (wordStart.offset > wordEnd.offset) {
      throw new Error(`Invalid word cursor offset: ${wordStart.offset} should be less ${wordEnd.offset}.`)
    } else if (lineStart.key !== wordEnd.key) {
      throw new Error(`Cursor mismatch: Expect the same line but got ${lineStart.key} and ${wordEnd.key}.`)
    } else if (lineStart.block.text.length < wordEnd.offset) {
      throw new Error('Invalid cursor: Replacement length is larger than line length.')
    }

    const { block } = lineStart
    const { offset: left } = wordStart
    const { offset: right } = wordEnd

    // Replace word range with replacement.
    block.text = block.text.substr(0, left) + replacement + block.text.substr(right)

    // Update cursor
    if (setCursor) {
      const cursor = Object.assign({}, wordStart, {
        offset: left + replacement.length
      })
      line.start = cursor
      line.end = cursor
      this.cursor = {
        start: cursor,
        end: cursor
      }
    }

    this.partialRender()
    this.muya.dispatchSelectionChange()
    this.muya.dispatchChange()
  }

  /**
   * Replace the current selected word with the given replacement.
   *
   * NOTE: Unsafe method because exacly one word have to be selected. This
   * is currently used to replace a misspelled word in MarkText that was selected
   * by Chromium.
   *
   * @param {string} word The old word that should be replaced. The whole word must be selected.
   * @param {string} replacement The word to replace the selecte one.
   * @returns {boolean} True on success.
   */
  ContentState.prototype._replaceCurrentWordInlineUnsafe = function (word, replacement) {
    // Right clicking on a misspelled word select the whole word by Chromium.
    const { start, end } = selection.getCursorRange()
    const cursor = Object.assign({}, { start, end })
    cursor.start.block = this.getBlock(start.key)

    if (!validateLineCursor(cursor)) {
      console.warn('Unable to replace word: multiple lines are selected.', JSON.stringify(cursor))
      return false
    }

    const { start: startCursor } = cursor
    const { offset: lineOffset } = startCursor
    const { text } = startCursor.block
    const wordInfo = SpellChecker.extractWord(text, lineOffset)
    if (wordInfo) {
      const { left, right, word: selectedWord } = wordInfo
      if (selectedWord !== word) {
        console.warn(`Unable to replace word: Chromium selection mismatch ("${selectedWord}" vs "${word}").`)
        return false
      }

      // Translate offsets into a cursor with the given line.
      const wordRange = offsetToWordCursor(this.cursor, left, right)
      this.replaceWordInline(cursor, wordRange, replacement, true)
      return true
    }
    return false
  }
}

export default coreApi
